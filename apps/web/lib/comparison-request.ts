import type { CatalogueEntry } from '@padlownia/database';
import type { SearchParams } from './catalogue';
import { validateViewPayload, type ViewPayload } from './view-contract';

export type ComparisonRequest = {
  left: string; right: string; currentRelease: string;
  status: 'empty' | 'partial' | 'ready' | 'invalid_payload' | 'stale_release' | 'unknown_racket';
  payload?: ViewPayload;
};

export function resolveComparison(params: SearchParams, entries: CatalogueEntry[]): ComparisonRequest {
  const releases = new Set(entries.map((entry) => entry.releaseId));
  const currentRelease = releases.size === 1 ? entries[0]!.releaseId : '';
  const value = (key: string) => typeof params[key] === 'string' ? params[key] as string : '';
  const left = value('left');
  const right = value('right');
  const base = { left: entries.some((entry) => entry.id === left) ? left : '', right: entries.some((entry) => entry.id === right) ? right : '', currentRelease };
  if (Object.keys(params).some((key) => !['left', 'right', 'release'].includes(key))) return { ...base, status: 'invalid_payload' };
  const present = ['left', 'right', 'release'].some((key) => params[key] !== undefined);
  if (!present) return { ...base, status: 'empty' };
  if (['left', 'right', 'release'].some((key) => params[key] !== undefined && (typeof params[key] !== 'string' || value(key).length > 128 || (value(key) && !/^[A-Za-z0-9_-]+$/.test(value(key)))))) return { ...base, status: 'invalid_payload' };
  if (!currentRelease || value('release') !== currentRelease) return { ...base, status: 'stale_release' };
  if ((left && !base.left) || (right && !base.right)) return { ...base, status: 'unknown_racket' };
  if (!left || !right) return { ...base, status: left || right ? 'partial' : 'empty' };
  const validated = validateViewPayload({ version: 1, datasetVersion: value('release'), blocks: [{ type: 'racket_comparison', racketIds: [left, right] }] }, entries);
  return validated.ok ? { ...base, status: 'ready', payload: validated.payload } : { ...base, status: validated.reason };
}
