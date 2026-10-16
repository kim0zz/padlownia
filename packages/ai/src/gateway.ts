import { randomUUID } from 'node:crypto';
import { costPln, estimateTokens, type BudgetConfig, type ModelPrice, type UsageLedger, type UsageRecord } from './budget';

/**
 * Model Gateway (P-014): the only place the app talks to a paid model. Providers are replaceable;
 * every call is priced, budget-checked before it starts, timed and logged — including failures.
 */

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface CompletionRequest {
  /** What the call is for, e.g. "assistant.answer" or "eval.judge"; used for cost reports. */
  purpose: string;
  model: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  temperature?: number;
  /** Ask the provider for a JSON object. The caller still validates it with a schema. */
  json?: boolean;
  timeoutMs?: number;
}
export interface ProviderCompletion {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** Cost reported by the provider, when it reports one (OpenRouter does); preferred over our estimate. */
  providerCostUsd?: number;
}
export interface ModelProvider {
  readonly name: string;
  complete(request: CompletionRequest, signal: AbortSignal): Promise<ProviderCompletion>;
}

export class GatewayError extends Error {
  constructor(public readonly code: 'BUDGET_EXCEEDED' | 'CALL_TOO_EXPENSIVE' | 'MODEL_NOT_CONFIGURED' | 'PROVIDER_FAILED' | 'TIMEOUT' | 'REQUEST_INVALID') {
    super(code);
  }
}

export interface GatewayOptions {
  provider: ModelProvider;
  ledger: UsageLedger;
  budget: BudgetConfig;
  /** Allow-list of models with their prices. A model without a price cannot be called. */
  prices: Record<string, ModelPrice>;
  now?: () => Date;
  onRecord?: (record: UsageRecord) => void;
}

export interface CompletionResult extends ProviderCompletion { requestId: string; costPln: number; latencyMs: number }

export class ModelGateway {
  constructor(private readonly options: GatewayOptions) {}

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const now = this.options.now ?? (() => new Date());
    const requestId = randomUUID();
    const price = this.options.prices[request.model];
    const base = { requestId, purpose: request.purpose, model: request.model };
    const refuse = async (status: UsageRecord['status'], code: GatewayError['code']): Promise<never> => {
      await this.record({ ...base, at: now().toISOString(), status, inputTokens: 0, outputTokens: 0, costPln: 0, latencyMs: 0, errorCode: code });
      throw new GatewayError(code);
    };

    if (!Number.isInteger(request.maxOutputTokens) || request.maxOutputTokens < 1 || !request.messages.length) throw new GatewayError('REQUEST_INVALID');
    if (!price) return refuse('refused_config', 'MODEL_NOT_CONFIGURED');

    const { budget } = this.options;
    const estimatedInput = estimateTokens(request.messages.map((message) => message.content).join('\n'));
    const worstCase = costPln(price, estimatedInput, request.maxOutputTokens, budget.usdToPln);
    if (worstCase > budget.maxCallPln) return refuse('refused_budget', 'CALL_TOO_EXPENSIVE');
    if (!await this.options.ledger.reserve(requestId, worstCase, budget.monthlyCapPln, now())) return refuse('refused_budget', 'BUDGET_EXCEEDED');

    const started = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 30_000);
    try {
      const result = await this.options.provider.complete(request, controller.signal);
      const latencyMs = Math.round(performance.now() - started);
      const computed = costPln(price, result.inputTokens, result.outputTokens, budget.usdToPln);
      const cost = result.providerCostUsd !== undefined ? Math.max(computed, result.providerCostUsd * budget.usdToPln) : computed;
      await this.record({ ...base, at: now().toISOString(), status: 'ok', inputTokens: result.inputTokens, outputTokens: result.outputTokens, costPln: cost, latencyMs });
      return { ...result, requestId, costPln: cost, latencyMs };
    } catch {
      const timedOut = controller.signal.aborted;
      // A failed call may still have been billed; settle at the reserved worst case to stay on the safe side.
      await this.record({ ...base, at: now().toISOString(), status: 'error', inputTokens: 0, outputTokens: 0, costPln: worstCase,
        latencyMs: Math.round(performance.now() - started), errorCode: timedOut ? 'TIMEOUT' : 'PROVIDER_FAILED' });
      throw new GatewayError(timedOut ? 'TIMEOUT' : 'PROVIDER_FAILED');
    } finally {
      clearTimeout(timer);
    }
  }

  /** Every attempt is logged, refusals included, so cost reports also show what was blocked. */
  private async record(record: UsageRecord) {
    await this.options.ledger.settle(record);
    this.options.onRecord?.(record);
  }
}

/**
 * OpenAI-compatible chat endpoint (OpenRouter by default). Not exercised against the network in tests;
 * the key comes from server-side environment only and is never logged.
 */
export class OpenAiCompatibleProvider implements ModelProvider {
  readonly name: string;
  constructor(private readonly config: { apiKey: string; baseUrl?: string; name?: string; fetch?: typeof fetch }) {
    if (!config.apiKey) throw new GatewayError('MODEL_NOT_CONFIGURED');
    this.name = config.name ?? 'openrouter';
  }

  async complete(request: CompletionRequest, signal: AbortSignal): Promise<ProviderCompletion> {
    const doFetch = this.config.fetch ?? fetch;
    const response = await doFetch(`${this.config.baseUrl ?? 'https://openrouter.ai/api/v1'}/chat/completions`, {
      method: 'POST', signal, redirect: 'error',
      headers: { authorization: `Bearer ${this.config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: request.model, messages: request.messages, max_tokens: request.maxOutputTokens, temperature: request.temperature ?? 0,
        ...(request.json ? { response_format: { type: 'json_object' } } : {}), usage: { include: true },
      }),
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const body = await response.json() as {
      choices?: { message?: { content?: unknown } }[];
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown };
    };
    const text = body.choices?.[0]?.message?.content;
    const inputTokens = body.usage?.prompt_tokens, outputTokens = body.usage?.completion_tokens;
    if (typeof text !== 'string' || typeof inputTokens !== 'number' || typeof outputTokens !== 'number') throw new Error('RESPONSE_SHAPE');
    return { text, inputTokens, outputTokens, ...(typeof body.usage?.cost === 'number' ? { providerCostUsd: body.usage.cost } : {}) };
  }
}
