import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const stubs = vi.hoisted(() => ({ catalogue: vi.fn() }));
vi.mock('../../apps/web/lib/catalogue-server', () => ({ getCatalogue: stubs.catalogue }));

import RacketPage from '../../apps/web/app/rakiety/[id]/page';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';

afterEach(() => vi.resetAllMocks());

describe('released profile rendering with extensible source attributes', () => {
  it('renders prototype-shaped field names as literal source labels without crashing', async () => {
    const entry = structuredClone(fixtureCatalogue[0]!);
    entry.specs = ['__proto__', 'constructor', 'toString'].map((key, index) => ({
      ...entry.specs[0]!, key, selected: false,
      evidence: { ...entry.specs[0]!.evidence, observationId: `synthetic-extra-${index}` },
    }));
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'supabase', entries: [entry] });
    const html = renderToStaticMarkup(await RacketPage({ params: Promise.resolve({ id: entry.id }) }));
    for (const key of ['__proto__', 'constructor', 'toString']) expect(html).toContain(`<h3>${key}</h3>`);
  });
});
