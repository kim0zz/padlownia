import 'server-only';
import { readFile, stat } from 'node:fs/promises';
import type { CatalogueEntry } from '@padlownia/database';
import { attachApprovedImages } from './catalogue-images';

export async function loadCatalogueImages(entries: CatalogueEntry[]) {
  const path = process.env.CATALOGUE_IMAGE_MANIFEST;
  if (!path) return attachApprovedImages(entries, null);
  try {
    if ((await stat(path)).size > 1024 * 1024) return attachApprovedImages(entries, null);
    return attachApprovedImages(entries, JSON.parse(await readFile(path, 'utf8')));
  } catch { return attachApprovedImages(entries, null); }
}
