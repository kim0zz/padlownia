#!/usr/bin/env node
// Measures time to first byte (TTFB) and full response time of the main pages of a running web app.
// Usage: node scripts/measure-ttfb.mjs [baseUrl] [runs]   e.g. node scripts/measure-ttfb.mjs http://127.0.0.1:3200 10
// /porownaj renders a comparison only with a release ID: set MEASURE_RELEASE=<active release id> unless the catalogue HTML exposes one.

const base = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const runs = Number(process.argv[3] ?? 10);

async function timed(path) {
  const start = performance.now();
  const response = await fetch(base + path, { redirect: 'manual', headers: { 'cache-control': 'no-cache' } });
  const ttfb = performance.now() - start;
  const body = await response.text();
  return { status: response.status, ttfb, total: performance.now() - start, bytes: Buffer.byteLength(body), body };
}

const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { min: sorted[0], median: pick(0.5), p90: pick(0.9), max: sorted.at(-1) };
};
const ms = (value) => `${Math.round(value)} ms`;

// Discover real IDs from the catalogue page so the script works on any data set.
const home = await timed('/');
if (home.status !== 200) throw new Error(`GET / returned ${home.status}`);
const ids = [...new Set([...home.body.matchAll(/href="\/rakiety\/([^"?#/]+)/g)].map((match) => decodeURIComponent(match[1])))];
if (ids.length < 2) throw new Error('Found fewer than two racket links on /');
const release = process.env.MEASURE_RELEASE ?? home.body.match(/release=([0-9a-zA-Z-]+)/)?.[1];
const compare = new URLSearchParams({ ...(release ? { release } : {}), left: ids[0], right: ids[1] });

const pages = [
  ['/', '/'],
  ['/rakiety/[id]', `/rakiety/${encodeURIComponent(ids[0])}`],
  ['/porownaj', `/porownaj?${compare}`],
];

console.log(`Base: ${base} · runs per page: ${runs} (first request per page reported separately as "cold")`);
if (!release) console.warn('No release ID found: /porownaj will show the picker, not a comparison. Set MEASURE_RELEASE.');
for (const [label, path] of pages) {
  const cold = await timed(path);
  const samples = [];
  for (let i = 0; i < runs; i += 1) samples.push(await timed(path));
  const ttfb = stats(samples.map((sample) => sample.ttfb));
  const total = stats(samples.map((sample) => sample.total));
  const statuses = [...new Set(samples.map((sample) => sample.status))].join(',');
  // Pages stream a loading fallback first, so TTFB stays tiny; the full response time is what a visitor waits for.
  console.log(`${label.padEnd(14)} status ${statuses} · full median ${ms(total.median)} p90 ${ms(total.p90)} (min ${ms(total.min)}, max ${ms(total.max)}) · cold full ${ms(cold.total)} · TTFB median ${ms(ttfb.median)} · HTML ${(samples[0].bytes / 1024).toFixed(0)} KB`);
}
