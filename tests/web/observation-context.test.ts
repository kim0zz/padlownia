import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ObservationDetails } from '../../apps/web/components/racket-details';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';

const spec = { ...structuredClone(fixtureCatalogue[0]!.specs[0]!), measurementContext: { sourceField: 'play_style', sourceSchemaPath: '/fields/play_style', grips: 'one_overgrip' } };
const render = (dev: boolean) => renderToStaticMarkup(createElement(ObservationDetails, { spec, releaseId: 'r', dev }));

describe('observation context (P-032)', () => {
  it('hides source schema metadata from visitors but keeps measurement context', () => {
    const html = render(false);
    expect(html).not.toContain('sourceField');
    expect(html).not.toContain('sourceSchemaPath');
    expect(html).toContain('grips: one_overgrip');
  });
  it('shows the full context in developer mode', () => {
    expect(render(true)).toContain('sourceSchemaPath: /fields/play_style');
  });
});
