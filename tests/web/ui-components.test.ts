import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Badge } from '../../apps/web/components/ui/badge';
import { Notice } from '../../apps/web/components/ui/notice';
import { PageHeader } from '../../apps/web/components/ui/page-header';
import { SourceInfo } from '../../apps/web/components/ui/source-info';
import { closeSourceInfo } from '../../apps/web/components/ui/source-info-closer';
import { StatBar } from '../../apps/web/components/ui/stat-bar';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';

const spec = fixtureCatalogue[0]!.specs.find((item) => item.claimType === 'measured_specimen')!;
const declared = fixtureCatalogue[0]!.specs.find((item) => item.selected)!;

describe('ui/Badge', () => {
  it('renders the tone as a class and defaults to neutral', () => {
    expect(renderToStaticMarkup(createElement(Badge, { children: '2027' }))).toBe('<span class="badge badge-neutral">2027</span>');
    expect(renderToStaticMarkup(createElement(Badge, { tone: 'warning', children: 'Rozbieżne źródła' }))).toBe('<span class="badge badge-warning">Rozbieżne źródła</span>');
    expect(renderToStaticMarkup(createElement(Badge, { tone: 'info', children: 'Wybrano' }))).toContain('badge-info');
  });
  it('escapes text', () => {
    expect(renderToStaticMarkup(createElement(Badge, { children: '<script>x</script>' }))).not.toContain('<script>');
  });
});

describe('ui/SourceInfo', () => {
  const render = (props: Partial<Parameters<typeof SourceInfo>[0]> = {}) => renderToStaticMarkup(createElement(SourceInfo, {
    label: 'Źródło: Masa', items: [{ evidence: spec.evidence, claim: 'Pomiar egzemplarza' }, { evidence: declared.evidence, claim: 'Deklaracja producenta' }], ...props,
  }));
  it('is a native details popover with a labelled summary, citation and retrieval date', () => {
    const html = render();
    expect(html).toContain('<details class="source-info">');
    expect(html).toMatch(/<summary aria-label="Źródło: Masa: [^"]+">/);
    expect(html).toContain('class="source-info-panel" role="group" aria-label="Źródło: Masa"');
    expect(html).toContain('Pomiar egzemplarza');
    expect(html).toContain('Deklaracja producenta');
    expect(html).toContain(spec.evidence.sourceName);
    expect(html).toContain('Pobrano ');
    expect(html.match(/class="source-info-date"/g)).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
  });
  it('names each source once in the accessible label', () => {
    const html = render({ items: [{ evidence: spec.evidence, claim: 'a' }, { evidence: spec.evidence, claim: 'b' }] });
    const label = html.match(/<summary aria-label="([^"]+)"/)![1]!;
    expect(label.split(spec.evidence.sourceName)).toHaveLength(2);
  });
  it('shows technical provenance only in developer mode', () => {
    expect(render()).not.toContain(spec.evidence.observationId);
    expect(render()).not.toContain(spec.evidence.path);
    expect(render({ dev: false })).not.toContain('source-info-dev');
    const dev = render({ dev: true });
    expect(dev).toContain(spec.evidence.observationId);
    expect(dev).toContain(spec.evidence.path);
  });
  it('keeps executable source URLs out of links', () => {
    const evidence = { ...spec.evidence, sourceUrl: 'javascript:alert(1)', attribution: null };
    const html = renderToStaticMarkup(createElement(SourceInfo, { label: 'Źródło', items: [{ evidence, claim: 'x' }] }));
    expect(html).not.toContain('href=');
    expect(html).toContain(evidence.sourceName);
  });
});

describe('ui/StatBar, PageHeader and Notice', () => {
  it('renders a labelled meter in the column colour', () => {
    const html = renderToStaticMarkup(createElement(StatBar, { value: 7.5, min: 0, max: 10, tone: 'b', label: 'Kontrola: 7.5 w skali 0–10' }));
    expect(html).toContain('<meter class="stat-bar stat-bar-b" min="0" max="10" value="7.5" aria-label="Kontrola: 7.5 w skali 0–10">');
  });
  it('renders the title as the only h1 with optional back link, meta and actions', () => {
    const full = renderToStaticMarkup(createElement(PageHeader, { title: 'Porównanie', meta: '2 rakiety', actions: 'Akcja', back: { href: '/', label: 'Katalog' } }));
    expect(full.match(/<h1/g)).toHaveLength(1);
    expect(full).toContain('<h1 class="page-header-title">Porównanie</h1>');
    expect(full).toContain('href="/"');
    expect(full).toContain('Katalog');
    expect(full).toContain('page-header-meta');
    expect(full).toContain('page-header-actions');
    const bare = renderToStaticMarkup(createElement(PageHeader, { title: 'Katalog rakiet' }));
    expect(bare).not.toContain('page-header-meta');
    expect(bare).not.toContain('page-header-actions');
    expect(bare).not.toContain('back-link');
  });
  it('renders notices by tone with an optional live role', () => {
    expect(renderToStaticMarkup(createElement(Notice, { children: 'Info' }))).toBe('<div class="notice notice-info">Info</div>');
    expect(renderToStaticMarkup(createElement(Notice, { tone: 'warning', role: 'status', children: 'Uwaga' }))).toBe('<div class="notice notice-warning" role="status">Uwaga</div>');
  });
});

describe('ui/SourceInfoCloser logic', () => {
  const details = (inside: unknown[]) => {
    const log: string[] = [];
    return { log, node: { contains: (node: unknown) => inside.includes(node), removeAttribute: (name: string) => log.push(`remove:${name}`),
      querySelector: (selector: string) => ({ focus: () => log.push(`focus:${selector}`) }) } };
  };
  it('closes only popovers that do not contain the click target', () => {
    const inside = details(['icon']); const other = details(['x']);
    closeSourceInfo({ type: 'click', target: 'icon' }, [inside.node, other.node], null);
    expect(inside.log).toEqual([]);
    expect(other.log).toEqual(['remove:open']);
  });
  it('closes on Escape and returns focus to the summary of the focused popover', () => {
    const first = details([]); const focused = details(['button']);
    closeSourceInfo({ type: 'keydown', key: 'Escape', target: null }, [first.node, focused.node], 'button');
    expect(first.log).toEqual(['remove:open']);
    expect(focused.log).toEqual(['remove:open', 'focus::scope > summary']);
  });
  it('ignores other keys', () => {
    const open = details([]);
    closeSourceInfo({ type: 'keydown', key: 'Enter', target: null }, [open.node], null);
    expect(open.log).toEqual([]);
  });
});
