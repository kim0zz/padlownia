/**
 * Spend control for every paid model call (AGENTS.md: 100 PLN per month ceiling).
 * The check happens BEFORE the call, against the worst case the call could cost, so concurrent
 * requests cannot jointly overshoot: each one reserves its worst case until the real cost is known.
 */

/** Explicit price per model, in USD per million tokens. No built-in price list: prices change and must be configured. */
export interface ModelPrice { inputUsdPerMTok: number; outputUsdPerMTok: number }
export interface BudgetConfig {
  monthlyCapPln: number;
  /** Conversion used for accounting; configure conservatively (a higher rate spends the cap sooner). */
  usdToPln: number;
  /** Refuse any single call whose worst case exceeds this. Protects against runaway prompts. */
  maxCallPln: number;
}

export type UsageStatus = 'ok' | 'error' | 'refused_budget' | 'refused_config';
export interface UsageRecord {
  requestId: string;
  at: string;
  purpose: string;
  model: string;
  status: UsageStatus;
  inputTokens: number;
  outputTokens: number;
  costPln: number;
  latencyMs: number;
  /** Short machine code only; never provider error text, which may echo prompts or keys. */
  errorCode?: string;
}

export interface UsageLedger {
  /** Settled spend plus open reservations for the calendar month (UTC) containing `now`. */
  committedPln(now: Date): Promise<number>;
  /** Atomically reserve `amountPln` if it fits under `capPln`; returns false when it does not. */
  reserve(requestId: string, amountPln: number, capPln: number, now: Date): Promise<boolean>;
  /** Replace the reservation with the settled record. */
  settle(record: UsageRecord): Promise<void>;
  records(): Promise<UsageRecord[]>;
}

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

/**
 * Single-process ledger (tests, local runs, one long-lived server). A multi-instance deployment
 * (e.g. Vercel functions) needs the same contract backed by one database row lock — see docs/ai.
 */
export class InMemoryLedger implements UsageLedger {
  private readonly settled: UsageRecord[] = [];
  private readonly reservations = new Map<string, { amountPln: number; month: string }>();

  async committedPln(now: Date): Promise<number> {
    const month = monthKey(now);
    const settled = this.settled.filter((record) => record.at.startsWith(month)).reduce((sum, record) => sum + record.costPln, 0);
    const open = [...this.reservations.values()].filter((item) => item.month === month).reduce((sum, item) => sum + item.amountPln, 0);
    return settled + open;
  }

  async reserve(requestId: string, amountPln: number, capPln: number, now: Date): Promise<boolean> {
    // No await between the check and the insert: atomic within one Node.js process.
    const month = monthKey(now);
    const settled = this.settled.filter((record) => record.at.startsWith(month)).reduce((sum, record) => sum + record.costPln, 0);
    const open = [...this.reservations.values()].filter((item) => item.month === month).reduce((sum, item) => sum + item.amountPln, 0);
    if (settled + open + amountPln > capPln) return false;
    this.reservations.set(requestId, { amountPln, month });
    return true;
  }

  async settle(record: UsageRecord): Promise<void> {
    this.reservations.delete(record.requestId);
    this.settled.push(record);
  }

  async records(): Promise<UsageRecord[]> { return [...this.settled]; }
}

export function costPln(price: ModelPrice, inputTokens: number, outputTokens: number, usdToPln: number): number {
  return ((inputTokens * price.inputUsdPerMTok + outputTokens * price.outputUsdPerMTok) / 1_000_000) * usdToPln;
}

/** Conservative token estimate before the call (about 3 characters per token; real usage settles it). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3);
