import { describe, expect, it } from 'vitest';
import {
  buildLexicalIndex, chunkReviewDetail, chunkReviewMarkdown, cleanMarkdown, parseGoldenJsonl, retrieveBalanced, retrieveLexical,
  scoreCase, sectionKind, summarize, tokenize, CHUNKER_VERSION, type ReviewChunk,
} from '@padlownia/ai';

// Synthetic review in the inspected padel.how layout. Never real source text.
const review = `
---
title: "TESTLAB Orbit Control 2026 — 70/100"
url: "https://padel.how/equipment/racket/testlab-orbit-control-2026-review/"
---

## Direct answer

> Review of TESTLAB Orbit Control 2026: compare its shape, balance, feel and on-court handling.

# TESTLAB Orbit Control 2026

## Where to buy

[Shop€199→](https://shop.example/orbit)
Retailer links may be affiliate links — we may earn a commission at no extra cost to you.
## Version and lineup identification

The Orbit Control sits below the [Orbit Pro](https://padel.how/equipment/racket/testlab-orbit-pro-2026-review/) in the lineup.

## TESTLAB Orbit Control 2026 — Technical specifications

## Construction and materials

A soft EVA core and a fiberglass face give a calm, comfortable response that protects the elbow.

## Power and smash behavior

Flat smashes need a full swing; the racket does not finish points on its own when you smash from the back.

## Technical positioning

The racket fits careful defenders.

### Defensive output and depth

Lobs and deep defensive returns are easy to place from the back glass with this controlled racket.
`;
const input = { text: review, sha256: 'a'.repeat(64), slug: 'testlab-orbit-control-2026-review', url: 'https://padel.how/equipment/racket/testlab-orbit-control-2026-review/' };

describe('chunkReviewMarkdown', () => {
  const chunks = chunkReviewMarkdown(input, { minChars: 10 });

  it('keeps evidence sections and drops meta description, commerce and empty spec headings', () => {
    expect(chunks.map((chunk) => chunk.kind)).toEqual(['identification', 'construction', 'power', 'positioning', 'defense']);
    expect(chunks.some((chunk) => /affiliate|Shop/.test(chunk.text))).toBe(false);
    expect(chunks.every((chunk) => chunk.chunkerVersion === CHUNKER_VERSION && chunk.slug === input.slug)).toBe(true);
  });

  it('keeps exact source offsets so every chunk can be cited back to the original text', () => {
    for (const chunk of chunks) {
      if (chunk.locator.type !== 'span') throw new Error('expected span');
      const original = review.slice(chunk.locator.start, chunk.locator.end);
      expect(cleanMarkdown(original).text).toBe(chunk.text);
    }
  });

  it('records linked rackets as mentions, never as the chunk subject', () => {
    const identification = chunks.find((chunk) => chunk.kind === 'identification')!;
    expect(identification.slug).toBe(input.slug);
    expect(identification.mentions).toEqual(['testlab-orbit-pro-2026-review']);
    expect(identification.text).toContain('Orbit Pro in the lineup');
  });

  it('nests ### headings under their section and is deterministic', () => {
    expect(chunks.at(-1)!.heading).toBe('Technical positioning > Defensive output and depth');
    expect(chunkReviewMarkdown(input, { minChars: 10 }).map((chunk) => chunk.id)).toEqual(chunks.map((chunk) => chunk.id));
  });

  it('splits long sections at paragraph boundaries within the size limit', () => {
    const long = `## Power and smash behavior\n\n${Array.from({ length: 6 }, (_, i) => `Paragraph ${i} about smash power. `.repeat(8)).join('\n\n')}`;
    const pieces = chunkReviewMarkdown({ ...input, text: long }, { maxChars: 600 });
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((chunk) => chunk.kind === 'power' && chunk.locator.type === 'span' && chunk.locator.end - chunk.locator.start <= 600)).toBe(true);
  });
});

describe('chunkReviewDetail', () => {
  it('cites verdict and FAQ entries by JSON pointer', () => {
    const chunks = chunkReviewDetail({ ...input, json: { verdict: 'Best for calm defenders.', faq: [{ question: 'Is it soft?', answer: 'Yes, the core is soft.' }, { question: 1 }] } });
    expect(chunks.map((chunk) => [chunk.kind, chunk.locator])).toEqual([
      ['verdict', { type: 'json_pointer', pointer: '/verdict' }],
      ['faq', { type: 'json_pointer', pointer: '/faq/0' }],
    ]);
  });
});

describe('sectionKind', () => {
  it.each([
    ['Comparison within the HEAD lineup', 'comparison'], ['Stiffness, feel, and comfort', 'feel'], ['Net performance under pace', 'net'],
    ['Off-center stability and torsional resistance', 'stability'], ['12K versus 18K in the AT10 family', 'comparison'], ['Something new', 'other'],
  ])('%s → %s', (heading, kind) => expect(sectionKind(heading)).toBe(kind));
});

describe('lexical retrieval', () => {
  const other: ReviewChunk[] = chunkReviewMarkdown({ ...input, slug: 'testlab-arc-2026-review', sha256: 'b'.repeat(64),
    text: '## Power and smash behavior\n\nThis TESTLAB Orbit Control comparison mentions smash power many times: smash smash power.' });
  const index = buildLexicalIndex([...chunkReviewMarkdown(input, { minChars: 10 }), ...other]);

  it('never returns chunks outside the resolved rackets, even when another review mentions the name', () => {
    const results = retrieveLexical(index, 'TESTLAB Orbit Control smash power', { slugs: [input.slug] });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.chunk.slug === input.slug)).toBe(true);
  });

  it('answers a Polish question from English evidence through the glossary, after removing the racket name', () => {
    const [top] = retrieveLexical(index, 'Jak TESTLAB Orbit Control broni z tyłu?', { slugs: [input.slug], ignoreText: 'TESTLAB orbit control 2026' });
    expect(top?.chunk.kind).toBe('defense');
    expect(retrieveLexical(index, 'Jak TESTLAB Orbit Control broni z tyłu?', { slugs: [input.slug], expandPolishQuery: false, ignoreText: 'TESTLAB orbit control 2026' })).toEqual([]);
  });

  it('folds diacritics and simple inflection', () => {
    expect(tokenize('Łokieć')).toEqual(tokenize('lokiec'));
    expect(tokenize('controlled smashes')).toEqual(tokenize('control smash'));
  });

  it('balances evidence across both rackets of a comparison', () => {
    const results = retrieveBalanced(index, 'smash power', { slugs: [input.slug, 'testlab-arc-2026-review'], limit: 2 });
    expect(new Set(results.map((result) => result.chunk.slug)).size).toBe(2);
  });
});

describe('retrieval evals', () => {
  const golden = '// comment\n{"id":"a","question":"Jak broni?","scope":["x"],"expected":[{"slug":"x","kinds":["defense"]}]}\n'
    + '{"id":"b","question":"Porównaj obronę","scope":["x","y"],"expected":[{"slug":"x","kinds":["defense"]},{"slug":"y","kinds":["defense"]}],"tags":["pair"]}';
  const fake = (slug: string, kind: ReviewChunk['kind']) => ({ score: 1, chunk: { slug, kind } as ReviewChunk });

  it('parses the golden JSONL and rejects duplicates', () => {
    expect(parseGoldenJsonl(golden).map((item) => item.id)).toEqual(['a', 'b']);
    expect(() => parseGoldenJsonl(golden + '\n' + golden.split('\n')[1])).toThrow('GOLDEN_CASE_DUPLICATE_ID');
  });

  it('requires evidence for every racket of a comparison', () => {
    const [single, pair] = parseGoldenJsonl(golden);
    expect(scoreCase(single!, [fake('x', 'power'), fake('x', 'defense')]).firstHitRank).toBe(2);
    expect(scoreCase(pair!, [fake('x', 'defense'), fake('x', 'power')]).firstHitRank).toBeNull();
    expect(scoreCase(pair!, [fake('x', 'defense'), fake('y', 'net'), fake('y', 'defense')]).firstHitRank).toBe(3);
    expect(summarize([{ id: 'a', firstHitRank: 1, tags: [] }, { id: 'b', firstHitRank: null, tags: [] }])).toEqual({ cases: 2, hitAt1: 0.5, hitAt3: 0.5, hitAt5: 0.5, mrr: 0.5 });
  });
});
