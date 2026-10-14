import { expect,it } from 'vitest';
import { profileSnapshot } from '../../apps/worker/src/profile.js';
it('distinguishes validation occurrences from affected source rows',() => {
  const bytes = Buffer.from(JSON.stringify({ count: 1,rackets: [{ id: 'synthetic',brand: 'Synthetic',name: 'Control',year: null,specs: { weight: '365',balance: '26.5' } }] }));
  const { summary } = profileSnapshot('padeltrue',bytes);
  expect(summary.sourceRowsDenominator).toBe(1);
  expect(summary.affectedRecordCounts.unknown_year).toBe(1);
  expect(summary.issueCounts.unknown_year).toBeGreaterThanOrEqual(1);
  expect(Object.values(summary.affectedRecordCounts).every(count => count <= summary.sourceRowsDenominator)).toBe(true);
});
