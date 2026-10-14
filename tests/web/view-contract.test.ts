import { describe, expect, it } from 'vitest';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';
import {
  MAX_VIEW_BLOCKS, MAX_VIEW_IDENTIFIER_LENGTH, validateViewPayload, viewPayloadSchema,
  type ViewPayload,
} from '../../apps/web/lib/view-contract';

const first = fixtureCatalogue[0]!;
const second = fixtureCatalogue[1]!;
const validPayload = (): ViewPayload => ({
  version: 1,
  datasetVersion: first.releaseId,
  blocks: [
    { type: 'racket_card', racketId: first.id },
    { type: 'racket_specs', racketId: first.id },
    { type: 'racket_comparison', racketIds: [first.id, second.id] },
  ],
});

describe('structured presentation contract v1', () => {
  it('accepts all supported blocks for present fixture IDs without requiring UUIDs', () => {
    const payload = validPayload();
    expect(validateViewPayload(payload, fixtureCatalogue)).toEqual({ ok: true, payload });
    expect(viewPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('returns a parsed copy and never adds source facts, text or URLs', () => {
    const input = validPayload();
    const result = validateViewPayload(input, fixtureCatalogue);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a valid fixture view');
    expect(result.payload).not.toBe(input);
    expect(result.payload.blocks).not.toBe(input.blocks);
    input.blocks[0] = { type: 'racket_specs', racketId: second.id };
    expect(result.payload.blocks[0]).toEqual({ type: 'racket_card', racketId: first.id });
    expect(Object.keys(result.payload)).toEqual(['version', 'datasetVersion', 'blocks']);
  });

  it.each([undefined, null, true, 1, [], 'not JSON', JSON.stringify(validPayload())].map((input) => ({ input })))('rejects non-object input %j', ({ input }) => {
    expect(validateViewPayload(input, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
  });

  it.each([0, 2, '1', null, undefined])('rejects unsupported or coerced version %j', (version) => {
    expect(validateViewPayload({ ...validPayload(), version }, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
  });

  it.each([
    { html: '<script>alert(1)</script>' },
    { text: 'This racket scores 100/100.' },
    { sourceUrl: 'https://example.com/unverified' },
    { specs: { weight: 365 } },
    { dangerouslySetInnerHTML: { __html: '<img src=x onerror=alert(1)>' } },
  ])('rejects arbitrary envelope keys instead of silently stripping them: %j', (extra) => {
    expect(validateViewPayload({ ...validPayload(), ...extra }, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
  });

  it.each([
    { type: 'racket_card', racketId: first.id, title: 'Invented product claim' },
    { type: 'racket_specs', racketId: first.id, values: { weight: 1 } },
    { type: 'racket_specs', racketId: first.id, sourceUrl: 'https://example.com' },
    { type: 'racket_comparison', racketIds: [first.id, second.id], winnerId: first.id },
    { type: 'racket_card', racketId: first.id, html: '<b>Unverified</b>' },
    { type: 'racket_card', racketId: first.id, onClick: 'alert(1)' },
    { type: 'html', html: '<h1>Unapproved block</h1>' },
    { type: 'racket_comparison', racketId: first.id },
    { type: 'racket_card', racketId: { id: first.id } },
    { type: 'racket_specs', racketId: 0 },
  ])('rejects unknown block fields, types and model-supplied values: %j', (block) => {
    expect(validateViewPayload({ ...validPayload(), blocks: [block] }, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
  });

  it('rejects a JSON prototype key as an extra field', () => {
    const input = JSON.parse(`{"version":1,"datasetVersion":"${first.releaseId}","blocks":[{"type":"racket_card","racketId":"${first.id}","__proto__":{"html":"injected"}}]}`);
    expect(validateViewPayload(input, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
    expect(Object.prototype).not.toHaveProperty('html');
  });

  it.each(['', ' ', ` ${first.id}`, `${first.id} `, '<script>alert(1)</script>', 'https://example.com', 'javascript:alert(1)', `id\n${first.id}`, 'a'.repeat(MAX_VIEW_IDENTIFIER_LENGTH + 1)])('rejects malformed or oversized identifiers: %j', (racketId) => {
    expect(validateViewPayload({ ...validPayload(), blocks: [{ type: 'racket_card', racketId }] }, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
  });

  it.each(['', ' ', '<b>release</b>', 'a'.repeat(MAX_VIEW_IDENTIFIER_LENGTH + 1)])('rejects invalid release identifiers: %j', (datasetVersion) => {
    expect(validateViewPayload({ ...validPayload(), datasetVersion }, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
  });

  it('accepts boundary-sized identifiers only when they are present in the supplied release', () => {
    const id = 'i'.repeat(MAX_VIEW_IDENTIFIER_LENGTH);
    const releaseId = 'r'.repeat(MAX_VIEW_IDENTIFIER_LENGTH);
    const entry = { ...first, id, releaseId };
    const payload = { version: 1, datasetVersion: releaseId, blocks: [{ type: 'racket_card', racketId: id }] };
    expect(validateViewPayload(payload, [entry])).toEqual({ ok: true, payload });
  });

  it('enforces a nonempty bounded block list without truncating oversized input', () => {
    const card = { type: 'racket_card' as const, racketId: first.id };
    expect(validateViewPayload({ ...validPayload(), blocks: [] }, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
    expect(validateViewPayload({ ...validPayload(), blocks: Array.from({ length: MAX_VIEW_BLOCKS }, () => card) }, fixtureCatalogue).ok).toBe(true);
    expect(validateViewPayload({ ...validPayload(), blocks: Array.from({ length: MAX_VIEW_BLOCKS + 1 }, () => card) }, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
  });

  it.each([[], [first.id], [first.id, first.id], [first.id, second.id, fixtureCatalogue[2]!.id], [first.id, null]].map((racketIds) => ({ racketIds })))('requires exactly two distinct comparison identifiers: %j', ({ racketIds }) => {
    expect(validateViewPayload({ ...validPayload(), blocks: [{ type: 'racket_comparison', racketIds }] }, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
  });

  it('rejects a stale release, an empty catalogue and any mixed-release catalogue', () => {
    expect(validateViewPayload({ ...validPayload(), datasetVersion: 'older-release' }, fixtureCatalogue)).toEqual({ ok: false, reason: 'stale_release' });
    expect(validateViewPayload(validPayload(), [])).toEqual({ ok: false, reason: 'stale_release' });
    const mixed = fixtureCatalogue.map((entry, index) => index === fixtureCatalogue.length - 1 ? { ...entry, releaseId: 'another-release' } : entry);
    // The changed entry is not referenced, but its presence still invalidates the dataset.
    expect(validateViewPayload(validPayload(), mixed)).toEqual({ ok: false, reason: 'stale_release' });
  });

  it.each([
    { type: 'racket_card', racketId: 'unknown-racket' },
    { type: 'racket_specs', racketId: 'unknown-racket' },
    { type: 'racket_comparison', racketIds: [first.id, 'unknown-racket'] },
  ])('requires every referenced racket to exist in the published entries: %j', (block) => {
    expect(validateViewPayload({ ...validPayload(), blocks: [block] }, fixtureCatalogue)).toEqual({ ok: false, reason: 'unknown_racket' });
  });

  it('checks identifiers exactly and rejects ambiguous duplicate catalogue IDs', () => {
    expect(validateViewPayload({ ...validPayload(), blocks: [{ type: 'racket_card', racketId: first.id.toUpperCase() }] }, fixtureCatalogue)).toEqual({ ok: false, reason: 'unknown_racket' });
    expect(validateViewPayload(validPayload(), [...fixtureCatalogue, { ...first, shape: 'diamond' }])).toEqual({ ok: false, reason: 'unknown_racket' });
  });

  it('does not return submitted values in a failure result', () => {
    const input = { ...validPayload(), html: 'sensitive-value-that-must-not-be-echoed' };
    expect(validateViewPayload(input, fixtureCatalogue)).toEqual({ ok: false, reason: 'invalid_payload' });
  });
});
