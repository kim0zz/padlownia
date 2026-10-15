import { z } from 'zod';
import type { CatalogueEntry } from '@padlownia/database';

const safeAssetUrl = z.string().max(2048).refine((raw) => {
  if (/^\/media\/rackets\/[A-Za-z0-9_-]+\.(webp|png|jpe?g|avif|svg)$/.test(raw)) return true;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search
      && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname) && url.hostname.includes('.') && !url.hostname.endsWith('.invalid');
  } catch { return false; }
});
const referenceUrl = z.string().url().max(2048).refine((raw) => {
  try {
    const url = new URL(raw); return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
});
export const catalogueImageSchema = z.strictObject({
  racketId: z.string().min(1).max(128), releaseId: z.string().min(1).max(128),
  url: safeAssetUrl, alt: z.string().min(1).max(500), credit: z.string().min(1).max(300),
  sourceUrl: referenceUrl, rightsStatus: z.literal('approved'),
  licence: z.enum(['CC0', 'CC-BY-4.0', 'written-permission']),
  permissionReference: z.union([referenceUrl, z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$/)]),
});
export type CatalogueImage = z.infer<typeof catalogueImageSchema>;
export type PublicRacketImage = Pick<CatalogueImage, 'url' | 'alt' | 'credit' | 'sourceUrl' | 'licence'>;
export type IllustratedCatalogueEntry = CatalogueEntry & { image?: CatalogueImage };
export const imageManifestSchema = z.strictObject({ version: z.literal(1), images: z.array(catalogueImageSchema).max(2000) });

export function approvedImageFor(entry: IllustratedCatalogueEntry): PublicRacketImage | undefined {
  const result = catalogueImageSchema.safeParse(entry.image);
  if (!result.success || result.data.racketId !== entry.id || result.data.releaseId !== entry.releaseId) return undefined;
  const { url, alt, credit, sourceUrl, licence } = result.data;
  return { url, alt, credit, sourceUrl, licence };
}

/** The optional manifest is reviewed independently of source-data permission.
 * Exact release + ID matching prevents transferring a photo between variants.
 */
export function attachApprovedImages(entries: CatalogueEntry[], raw: unknown): IllustratedCatalogueEntry[] {
  const manifest = imageManifestSchema.safeParse(raw);
  const images = manifest.success ? manifest.data.images : [];
  return entries.map((entry) => {
    const matches = images.filter((image) => image.racketId === entry.id && image.releaseId === entry.releaseId);
    return { ...entry, image: matches.length === 1 ? matches[0] : undefined };
  });
}
