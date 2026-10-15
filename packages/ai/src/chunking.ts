import { createHash } from 'node:crypto';

/** Bump when chunk boundaries, kinds or cleaning change; old chunks stay valid for their version. */
export const CHUNKER_VERSION = 'review-chunks-v1';

/** Review section kinds. Headings are English in the source; kinds are stable, language-neutral keys. */
export const SECTION_KINDS = [
  'summary', 'identification', 'construction', 'shape', 'sweet_spot', 'power', 'net', 'defense', 'stability',
  'feel', 'spin', 'handling', 'positioning', 'comparison', 'takeaways', 'pros_cons', 'verdict', 'faq', 'other',
] as const;
export type SectionKind = typeof SECTION_KINDS[number];

export interface ReviewChunk {
  /** Deterministic: same document, chunker version and span give the same ID. */
  id: string;
  chunkerVersion: string;
  /** Exact catalogue slug of the review's own racket. Never a racket the text merely mentions. */
  slug: string;
  kind: SectionKind;
  /** Heading path, e.g. "Power and smash behavior" or "Technical positioning > Spin generation". */
  heading: string;
  /** Cleaned text used for ranking/embedding/prompting: links reduced to their label, whitespace collapsed. */
  text: string;
  /** Locator into the source: UTF-16 offsets into the document text (markdown) or a JSON pointer (detail JSON). */
  locator: { type: 'span'; start: number; end: number } | { type: 'json_pointer'; pointer: string };
  documentSha256: string;
  sourceUrl: string | null;
  /** Other reviewed rackets linked from this chunk. A mention is not identity: claims stay attributed to `slug`. */
  mentions: string[];
  /** Rough size estimate (characters / 4) for budgeting prompts; not a tokenizer. */
  approxTokens: number;
}

export interface ReviewDocumentInput { text: string; sha256: string; slug: string; url: string | null }
export interface ChunkOptions { maxChars?: number; minChars?: number }

const KIND_RULES: [RegExp, SectionKind][] = [
  [/direct answer/i, 'summary'],
  [/version|lineup identification|position in the lineup/i, 'identification'],
  [/comparison|versus|\bvs\.?\b/i, 'comparison'],
  [/construction|materials/i, 'construction'],
  [/shape|mould|mold/i, 'shape'],
  [/sweet spot|forgiveness/i, 'sweet_spot'],
  [/power|smash/i, 'power'],
  [/\bnet\b|fast exchanges/i, 'net'],
  [/defen[cs]/i, 'defense'],
  [/stability|torsion/i, 'stability'],
  [/stiffness|feel|comfort/i, 'feel'],
  [/spin/i, 'spin'],
  [/weight|balance|handling|maneuverab/i, 'handling'],
  [/positioning|fit\b|who is it for|best for/i, 'positioning'],
  [/takeaway|verdict|conclusion/i, 'takeaways'],
  [/^pros$|^cons$|pros and cons/i, 'pros_cons'],
];
/**
 * Sections with no evidential value for racket questions. "Direct answer" is the page's generic meta
 * description ("compare its shape, balance, feel…") and matched almost every query in the first eval run.
 */
const EXCLUDED_HEADINGS = [/where to buy/i, /technical specifications/i, /^direct answer$/i];
const AFFILIATE_LINE = /affiliate link|earn a commission/i;

export function sectionKind(heading: string): SectionKind {
  const leaf = heading.split(' > ').at(-1)!;
  return KIND_RULES.find(([pattern]) => pattern.test(leaf))?.[1] ?? 'other';
}

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const REVIEW_LINK = /\[([^\]]*)\]\((?:https:\/\/padel\.how)?\/equipment\/racket\/([a-z0-9-]+)\/?[^)]*\)/g;

/** Reduce markdown to plain evidence text, collecting linked review slugs. */
export function cleanMarkdown(markdown: string): { text: string; mentions: string[] } {
  const mentions = new Set<string>();
  const text = markdown
    .replace(REVIEW_LINK, (_, label: string, slug: string) => { mentions.add(slug); return label; })
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^>\s?/gm, '')
    .replace(/[*_`]+/g, '')
    .split(/\r?\n/).filter((line) => !AFFILIATE_LINE.test(line)).join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  return { text, mentions: [...mentions].sort() };
}

interface Section { heading: string; start: number; end: number }

/** Split at `##`/`###` headings; front matter and the H1 title are not evidence. */
function sections(text: string): Section[] {
  const frontMatter = text.match(/^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  const bodyStart = frontMatter ? frontMatter[0].length : 0;
  const headings = [...text.slice(bodyStart).matchAll(/^(#{1,3}) +(.+?)\s*$/gm)]
    .map((match) => ({ level: match[1]!.length, title: match[2]!, start: bodyStart + match.index!, bodyStart: bodyStart + match.index! + match[0].length }));
  const result: Section[] = [];
  let parent = '';
  for (const [index, heading] of headings.entries()) {
    const end = headings[index + 1]?.start ?? text.length;
    if (heading.level === 1) continue;
    if (heading.level === 2) parent = heading.title;
    const path = heading.level === 3 && parent ? `${parent} > ${heading.title}` : heading.title;
    result.push({ heading: path, start: heading.bodyStart, end });
  }
  return result;
}

/** Split an oversized section at paragraph boundaries, keeping exact source offsets. */
function pieces(text: string, section: Section, maxChars: number): { start: number; end: number }[] {
  const paragraphs: { start: number; end: number }[] = [];
  const pattern = /\S[\s\S]*?(?=\r?\n\s*\r?\n|$)/g;
  const body = text.slice(section.start, section.end);
  for (const match of body.matchAll(pattern)) paragraphs.push({ start: section.start + match.index!, end: section.start + match.index! + match[0].length });
  const result: { start: number; end: number }[] = [];
  for (const paragraph of paragraphs) {
    const current = result.at(-1);
    if (current && paragraph.end - current.start <= maxChars) current.end = paragraph.end;
    else result.push({ ...paragraph });
  }
  return result;
}

function chunk(input: ReviewDocumentInput, heading: string, kind: SectionKind, raw: string, locator: ReviewChunk['locator']): ReviewChunk | null {
  const { text, mentions } = cleanMarkdown(raw);
  if (!text) return null;
  const position = locator.type === 'span' ? `${locator.start}:${locator.end}` : locator.pointer;
  return {
    id: sha(`${CHUNKER_VERSION}|${input.sha256}|${position}`).slice(0, 24),
    chunkerVersion: CHUNKER_VERSION, slug: input.slug, kind, heading, text, locator,
    documentSha256: input.sha256, sourceUrl: input.url, mentions: mentions.filter((slug) => slug !== input.slug),
    approxTokens: Math.ceil(text.length / 4),
  };
}

/** Deterministic, heading-aware chunks of one exact racket review (markdown export). */
export function chunkReviewMarkdown(input: ReviewDocumentInput, options: ChunkOptions = {}): ReviewChunk[] {
  const maxChars = options.maxChars ?? 1800;
  const minChars = options.minChars ?? 60;
  const chunks: ReviewChunk[] = [];
  for (const section of sections(input.text)) {
    if (EXCLUDED_HEADINGS.some((pattern) => pattern.test(section.heading.split(' > ').at(-1)!))) continue;
    const kind = sectionKind(section.heading);
    for (const piece of pieces(input.text, section, maxChars)) {
      const result = chunk(input, section.heading, kind, input.text.slice(piece.start, piece.end), { type: 'span', start: piece.start, end: piece.end });
      if (result && result.text.length >= minChars) chunks.push(result);
    }
  }
  return chunks;
}

/** Verdict and FAQ items from a per-review detail JSON; each keeps a JSON-pointer citation. */
export function chunkReviewDetail(input: Omit<ReviewDocumentInput, 'text'> & { json: unknown }): ReviewChunk[] {
  const row = input.json !== null && typeof input.json === 'object' ? input.json as Record<string, unknown> : {};
  const base = { ...input, text: '' };
  const chunks: ReviewChunk[] = [];
  if (typeof row.verdict === 'string') {
    const verdict = chunk(base, 'Verdict', 'verdict', row.verdict, { type: 'json_pointer', pointer: '/verdict' });
    if (verdict) chunks.push(verdict);
  }
  if (Array.isArray(row.faq)) {
    row.faq.forEach((item, index) => {
      const entry = item !== null && typeof item === 'object' ? item as Record<string, unknown> : {};
      if (typeof entry.question !== 'string' || typeof entry.answer !== 'string') return;
      const faq = chunk(base, `FAQ > ${entry.question}`, 'faq', `${entry.question}\n${entry.answer}`, { type: 'json_pointer', pointer: `/faq/${index}` });
      if (faq) chunks.push(faq);
    });
  }
  return chunks;
}
