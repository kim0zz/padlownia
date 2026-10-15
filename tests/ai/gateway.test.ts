import { describe, expect, it, vi } from 'vitest';
import {
  GatewayError, InMemoryLedger, ModelGateway, OpenAiCompatibleProvider, costPln, validateAnswer,
  type CompletionRequest, type ModelProvider, type ProviderCompletion,
} from '@padlownia/ai';

const prices = { 'test/cheap': { inputUsdPerMTok: 1, outputUsdPerMTok: 4 } };
const budget = { monthlyCapPln: 100, usdToPln: 4, maxCallPln: 1 };
const request: CompletionRequest = { purpose: 'test', model: 'test/cheap', messages: [{ role: 'user', content: 'x'.repeat(3000) }], maxOutputTokens: 500 };
const provider = (result: Partial<ProviderCompletion> | Error, delayMs = 0): ModelProvider => ({
  name: 'fake',
  complete: async (_request, signal) => {
    if (delayMs) await new Promise((resolve, reject) => { const timer = setTimeout(resolve, delayMs); signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }); });
    if (result instanceof Error) throw result;
    return { text: '{}', inputTokens: 1000, outputTokens: 200, ...result };
  },
});
const now = () => new Date('2026-10-15T12:00:00Z');

describe('ModelGateway budget', () => {
  it('prices, logs and settles a successful call', async () => {
    const ledger = new InMemoryLedger();
    const gateway = new ModelGateway({ provider: provider({}), ledger, budget, prices, now });
    const result = await gateway.complete(request);
    expect(result.costPln).toBeCloseTo(costPln(prices['test/cheap'], 1000, 200, 4));
    expect(await ledger.committedPln(now())).toBeCloseTo(result.costPln);
    expect((await ledger.records()).map((record) => record.status)).toEqual(['ok']);
  });

  it('prefers the provider-reported cost when it is higher', async () => {
    const gateway = new ModelGateway({ provider: provider({ providerCostUsd: 0.01 }), ledger: new InMemoryLedger(), budget, prices, now });
    expect((await gateway.complete(request)).costPln).toBeCloseTo(0.04);
  });

  it('refuses before calling the provider once the month is spent, and logs the refusal', async () => {
    const ledger = new InMemoryLedger();
    await ledger.settle({ requestId: 'old', at: now().toISOString(), purpose: 'x', model: 'test/cheap', status: 'ok', inputTokens: 0, outputTokens: 0, costPln: 99.999, latencyMs: 0 });
    const complete = vi.fn();
    const gateway = new ModelGateway({ provider: { name: 'spy', complete }, ledger, budget, prices, now });
    await expect(gateway.complete(request)).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED' });
    expect(complete).not.toHaveBeenCalled();
    expect((await ledger.records()).at(-1)).toMatchObject({ status: 'refused_budget', costPln: 0 });
  });

  it('a new calendar month starts from zero', async () => {
    const ledger = new InMemoryLedger();
    await ledger.settle({ requestId: 'sept', at: '2026-09-30T23:59:00Z', purpose: 'x', model: 'test/cheap', status: 'ok', inputTokens: 0, outputTokens: 0, costPln: 100, latencyMs: 0 });
    await expect(new ModelGateway({ provider: provider({}), ledger, budget, prices, now }).complete(request)).resolves.toBeDefined();
  });

  it('concurrent calls cannot jointly exceed the cap: each reserves its worst case', async () => {
    const ledger = new InMemoryLedger();
    const tight = { ...budget, monthlyCapPln: 0.015 };
    const gateway = new ModelGateway({ provider: provider({}, 20), ledger, budget: tight, prices, now });
    const outcomes = await Promise.allSettled([gateway.complete(request), gateway.complete(request)]);
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(['fulfilled', 'rejected']);
  });

  it('refuses unknown models and single calls above the per-call ceiling', async () => {
    const gateway = new ModelGateway({ provider: provider({}), ledger: new InMemoryLedger(), budget, prices, now });
    await expect(gateway.complete({ ...request, model: 'test/unpriced' })).rejects.toMatchObject({ code: 'MODEL_NOT_CONFIGURED' });
    await expect(gateway.complete({ ...request, maxOutputTokens: 1_000_000 })).rejects.toMatchObject({ code: 'CALL_TOO_EXPENSIVE' });
  });

  it('charges the reserved worst case for failures and times out slow providers', async () => {
    const ledger = new InMemoryLedger();
    const failing = new ModelGateway({ provider: provider(new Error('boom: secret prompt text')), ledger, budget, prices, now });
    const error = await failing.complete(request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GatewayError);
    expect((error as Error).message).toBe('PROVIDER_FAILED');
    expect((await ledger.records())[0]!.costPln).toBeGreaterThan(0);
    const slow = new ModelGateway({ provider: provider({}, 200), ledger, budget, prices, now });
    await expect(slow.complete({ ...request, timeoutMs: 10 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});

describe('OpenAiCompatibleProvider', () => {
  it('sends a bounded JSON request and reads usage, without network access in tests', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 10, completion_tokens: 3, cost: 0.0001 } })));
    const result = await new OpenAiCompatibleProvider({ apiKey: 'test-key', fetch: fetchMock as typeof fetch }).complete({ ...request, json: true }, new AbortController().signal);
    expect(result).toEqual({ text: '{"ok":true}', inputTokens: 10, outputTokens: 3, providerCostUsd: 0.0001 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'test/cheap', max_tokens: 500, temperature: 0, response_format: { type: 'json_object' } });
  });

  it('rejects malformed responses and HTTP errors', async () => {
    const bad = new OpenAiCompatibleProvider({ apiKey: 'k', fetch: (async () => new Response('{}')) as typeof fetch });
    await expect(bad.complete(request, new AbortController().signal)).rejects.toThrow('RESPONSE_SHAPE');
    const down = new OpenAiCompatibleProvider({ apiKey: 'k', fetch: (async () => new Response('', { status: 429 })) as typeof fetch });
    await expect(down.complete(request, new AbortController().signal)).rejects.toThrow('HTTP_429');
    expect(() => new OpenAiCompatibleProvider({ apiKey: '' })).toThrow(GatewayError);
  });
});

describe('validateAnswer', () => {
  const evidence = new Map([
    ['chunk-power', 'Flat smashes need a full swing; mass is around 365 g in the tested sample.'],
    ['spec-weight', '360-375 g'],
  ]);
  const context = { allowedRackets: ['orbit', 'arc'], evidence, namesText: 'TESTLAB Orbit 2026' };
  const answer = (segments: unknown[], extra: object = {}) => ({ version: 1, intent: 'stats', rackets: ['orbit'], segments, ...extra });

  it('accepts cited, number-grounded segments', () => {
    const result = validateAnswer(answer([
      { kind: 'spec_fact', text: 'Waga: 360–375 g.', citations: ['spec-weight'] },
      { kind: 'source_opinion', text: 'Recenzent pisze, że płaski smecz wymaga pełnego zamachu (egzemplarz ok. 365 g).', citations: ['chunk-power'] },
      { kind: 'ai_inference', text: 'Orbit 2026 raczej nie skończy punktu sama z tyłu kortu.', citations: ['chunk-power'] },
      { kind: 'uncertainty', text: 'Źródło nie opisuje gry przy siatce.', citations: [] },
    ]), context);
    expect(result).toMatchObject({ ok: true });
  });

  it('catches invented numbers, missing or unknown citations and unknown rackets', () => {
    const result = validateAnswer(answer([
      { kind: 'source_opinion', text: 'Ma 9/10 za moc.', citations: ['chunk-power'] },
      { kind: 'ai_inference', text: 'Świetna dla obrońców.', citations: [] },
      { kind: 'spec_fact', text: 'Balans 27 cm.', citations: ['chunk-made-up'] },
    ], { rackets: ['orbit', 'hallucinated'] }), context);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      { code: 'unknown_racket', racket: 'hallucinated' },
      { code: 'ungrounded_number', segment: 0, number: '9' },
      { code: 'ungrounded_number', segment: 0, number: '10' },
      { code: 'missing_citation', segment: 1 },
      { code: 'unknown_citation', segment: 2, citation: 'chunk-made-up' },
    ]));
  });

  it('rejects long quotations, arbitrary shapes and clarifications outside a clarify turn', () => {
    const long = `"${'słowo '.repeat(30).trim()}"`;
    expect(validateAnswer(answer([{ kind: 'source_opinion', text: long, citations: ['chunk-power'] }]), context).violations).toEqual([{ code: 'long_quote', segment: 0 }]);
    expect(validateAnswer({ html: '<b>hi</b>' }, context).violations).toEqual([{ code: 'invalid_shape' }]);
    expect(validateAnswer(answer([], { clarification: { question: 'Który rocznik?', options: ['orbit', 'arc'] } }), context).violations)
      .toEqual([{ code: 'clarification_without_intent' }]);
  });
});
