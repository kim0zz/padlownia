import { z } from 'zod';
import type { CatalogueEntry } from '@padlownia/database/catalogue';

export const VIEW_CONTRACT_VERSION = 1;
export const MAX_VIEW_BLOCKS = 12;
export const MAX_VIEW_IDENTIFIER_LENGTH = 128;

// Opaque database/fixture identifiers, never model-authored prose, HTML or URLs.
// Do not trim or otherwise normalize an identifier before checking membership.
const identifierSchema = z.string().min(1).max(MAX_VIEW_IDENTIFIER_LENGTH).regex(/^[A-Za-z0-9_-]+$/);
const blockSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('racket_card'), racketId: identifierSchema }),
  z.strictObject({ type: z.literal('racket_specs'), racketId: identifierSchema }),
  z.strictObject({
    type: z.literal('racket_comparison'),
    racketIds: z.tuple([identifierSchema, identifierSchema]).refine(([left, right]) => left !== right),
  }),
]);

export const viewPayloadSchema = z.strictObject({
  version: z.literal(VIEW_CONTRACT_VERSION),
  datasetVersion: identifierSchema,
  blocks: z.array(blockSchema).min(1).max(MAX_VIEW_BLOCKS),
});

export type ViewPayload = z.infer<typeof viewPayloadSchema>;
export type ViewBlock = ViewPayload['blocks'][number];
export type ViewValidationResult =
  | { ok: true; payload: ViewPayload }
  | { ok: false; reason: 'invalid_payload' | 'stale_release' | 'unknown_racket' };

/** Validate a presentation request against one current published catalogue read.
 * The caller supplies entries from its approved read boundary, not model output.
 * Render only the returned payload, resolving every displayed fact from entries.
 * This function neither calls a model nor retrieves or authorizes a data release.
 */
export function validateViewPayload(input: unknown, entries: CatalogueEntry[]): ViewValidationResult {
  const parsed = viewPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_payload' };

  const payload = parsed.data;
  // Check the entire supplied catalogue, including entries absent from the view.
  // An empty/mixed snapshot cannot establish a consistent dataset version.
  if (!entries.length || entries.some((entry) => entry.releaseId !== payload.datasetVersion)) {
    return { ok: false, reason: 'stale_release' };
  }

  const racketIds = new Set(entries.map((entry) => entry.id));
  // A duplicated catalogue identifier is ambiguous even if its release matches.
  if (racketIds.size !== entries.length) return { ok: false, reason: 'unknown_racket' };
  for (const block of payload.blocks) {
    const references = block.type === 'racket_comparison' ? block.racketIds : [block.racketId];
    if (references.some((id) => !racketIds.has(id))) return { ok: false, reason: 'unknown_racket' };
  }
  return { ok: true, payload };
}
