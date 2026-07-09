#!/usr/bin/env node
// Smoke test for the data layer. Run against a local `vercel dev` server or a
// preview URL:
//
//   node smoke.mjs                                  # http://localhost:3000
//   node smoke.mjs https://rpt-git-branch.vercel.app
//
// Reads the LOCATIONS config straight out of public/index.html, so it always
// tests exactly the stops the app is configured to render. Exits 1 on failure.
//
// A stop with zero arrivals is a WARNING, never a failure: outside service
// hours every stop is legitimately empty. Only transport-layer faults (non-200,
// non-array payload) fail the run.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const ROOT = dirname(fileURLToPath(import.meta.url));
const CONCURRENCY = 4;

const pass = [];
const warn = [];
const fail = [];

const ok = (m) => { pass.push(m); console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const wr = (m) => { warn.push(m); console.log(`  \x1b[33m!\x1b[0m ${m}`); };
const no = (m) => { fail.push(m); console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

async function get(path) {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(15000) });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, body };
}

// Run tasks with a bounded worker pool so we don't trip TfL/NR rate limits.
async function pool(items, fn) {
  const queue = [...items];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

// ── Parse config out of the single-file app ────────────────────────────────
async function readConfig() {
  const html = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
  const all = (re) => [...html.matchAll(re)];

  const naptans = [...new Set(all(/naptan:'([^']+)'/g).map((m) => m[1]))];
  const crs = [...new Set(all(/crs:'([^']+)'/g).map((m) => m[1]))];
  const lines = [...new Map(
    all(/line:'([^']+)',\s*stopId:'([^']+)'/g).map((m) => [`${m[1]}|${m[2]}`, { line: m[1], stopId: m[2] }]),
  ).values()];

  if (!naptans.length || !crs.length || !lines.length) {
    throw new Error('Parsed 0 of some config type from public/index.html — did the LOCATIONS format change?');
  }
  return { naptans, crs, lines };
}

// ── Checks ─────────────────────────────────────────────────────────────────

// The ALLOWED regex in api/tfl.js is the only thing stopping this proxy from
// being an open relay for the TfL key. Assert it still rejects.
async function checkProxyGuard() {
  console.log('\nProxy guard (api/tfl.js ALLOWED regex)');
  const bad = [
    ['no path param', '/api/tfl'],
    ['arbitrary endpoint', '/api/tfl?path=Line/Meta/Modes'],
    ['path traversal', '/api/tfl?path=StopPoint/x/Arrivals/../../Line/Meta/Modes'],
    ['open relay attempt', '/api/tfl?path=https://example.com'],
  ];
  await pool(bad, async ([label, path]) => {
    try {
      const { status } = await get(path);
      status === 400
        ? ok(`rejects ${label} → 400`)
        : no(`${label} returned ${status}, expected 400 — proxy may be exploitable`);
    } catch (e) {
      no(`${label} threw: ${e.message}`);
    }
  });
}

async function checkBusStops(naptans) {
  console.log(`\nBus stops (${naptans.length} NaPTANs from LOCATIONS)`);
  await pool(naptans, async (n) => {
    try {
      const { status, body } = await get(`/api/tfl?path=StopPoint/${n}/Arrivals`);
      if (status !== 200) return no(`${n} → HTTP ${status}`);
      if (!Array.isArray(body)) return no(`${n} → payload is not an array`);
      if (body.length) return ok(`${n} → ${body.length} arrivals`);

      // Zero arrivals: mirror fetchBusStop's closure lookup so an empty board
      // is explained rather than silently green.
      const d = await get(`/api/tfl?path=StopPoint/${n}/Disruption`);
      const closure = Array.isArray(d.body) && d.body.find((x) => x.type === 'Closure');
      wr(closure ? `${n} → 0 arrivals (CLOSED until ${closure.toDate || 'unknown'})` : `${n} → 0 arrivals, no closure record`);
    } catch (e) {
      no(`${n} threw: ${e.message}`);
    }
  });
}

async function checkLines(lines) {
  console.log(`\nTube / tram (${lines.length} line+stop pairs)`);
  await pool(lines, async ({ line, stopId }) => {
    try {
      const { status, body } = await get(`/api/tfl?path=Line/${line}/Arrivals/${stopId}`);
      if (status !== 200) return no(`${line} @ ${stopId} → HTTP ${status}`);
      if (!Array.isArray(body)) return no(`${line} @ ${stopId} → payload is not an array`);
      body.length ? ok(`${line} @ ${stopId} → ${body.length} arrivals`) : wr(`${line} @ ${stopId} → 0 arrivals`);
    } catch (e) {
      no(`${line} @ ${stopId} threw: ${e.message}`);
    }
  });
}

// api/trains.js normalises LDBWS into { services, messages } — it does NOT pass
// through trainServices/generatedAt. The front end reads only that shape.
async function checkTrains(crsList) {
  console.log(`\nNational Rail (${crsList.length} CRS codes)`);
  await pool(crsList, async (crs) => {
    try {
      const { status, body } = await get(`/api/trains?crs=${crs}&rows=10`);
      if (status !== 200) return no(`${crs} → HTTP ${status}${body?.error ? ` (${body.error})` : ''}`);
      if (!body || typeof body !== 'object') return no(`${crs} → payload is not an object`);
      if (!Array.isArray(body.services)) return no(`${crs} → missing \`services\` array; trains.js contract broken`);
      if (!Array.isArray(body.messages)) return no(`${crs} → missing \`messages\` array; trains.js contract broken`);
      if (!body.services.length) return wr(`${crs} → 0 services (none running in the 30-min window)`);

      // Highlight matches on serviceId; a row without one can never be flagged.
      const noId = body.services.filter((s) => !s.serviceId).length;
      if (noId) return no(`${crs} → ${noId}/${body.services.length} services missing serviceId`);
      ok(`${crs} → ${body.services.length} services`);
    } catch (e) {
      no(`${crs} threw: ${e.message}`);
    }
  });
}

// Highlight works by intersecting serviceIds from a filterCrs board against the
// unfiltered board. Two ways that silently breaks: filterCrs gets ignored (every
// row highlights), or the serviceIds don't correspond (nothing ever highlights).
async function checkFilterCrs() {
  console.log('\nHighlight (filterCrs subset behaviour)');
  try {
    const [full, filtered] = await Promise.all([
      get('/api/trains?crs=WIM&rows=150'),
      get('/api/trains?crs=WIM&rows=150&filterCrs=RAY'),
    ]);
    if (full.status !== 200 || filtered.status !== 200) {
      return no(`WIM boards → HTTP ${full.status} / ${filtered.status}`);
    }
    const a = full.body?.services ?? [];
    const b = filtered.body?.services ?? [];
    if (!a.length) return wr('WIM board empty; cannot verify filterCrs right now');
    if (!b.length) return wr('filterCrs=RAY returned 0 services; cannot verify overlap right now');
    if (b.length > a.length) return no(`filterCrs=RAY returned ${b.length} services, more than the unfiltered ${a.length} — filter ignored?`);

    const ids = new Set(a.map((s) => s.serviceId));
    const hits = b.filter((s) => ids.has(s.serviceId)).length;
    if (!hits) return no(`none of the ${b.length} filterCrs serviceIds appear in the unfiltered board — highlight would never match`);
    if (hits < b.length) return wr(`${hits}/${b.length} filterCrs serviceIds matched (rest likely beyond the unfiltered row cap)`);
    ok(`filterCrs=RAY narrowed ${a.length} → ${b.length}, all serviceIds matched`);
  } catch (e) {
    no(`filterCrs check threw: ${e.message}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log(`Smoke test → ${BASE}`);

try {
  await get('/api/tfl');
} catch (e) {
  console.error(`\n\x1b[31mCannot reach ${BASE}\x1b[0m — is \`npx vercel dev\` running?\n  ${e.message}`);
  process.exit(1);
}

const { naptans, crs, lines } = await readConfig();

await checkProxyGuard();
await checkBusStops(naptans);
await checkLines(lines);
await checkTrains(crs);
await checkFilterCrs();

console.log(`\n${'─'.repeat(60)}`);
console.log(`\x1b[32m${pass.length} passed\x1b[0m  \x1b[33m${warn.length} warnings\x1b[0m  \x1b[31m${fail.length} failed\x1b[0m`);

if (fail.length) {
  console.log('\nFailures:');
  fail.forEach((f) => console.log(`  \x1b[31m✗\x1b[0m ${f}`));
  process.exit(1);
}
if (warn.length) console.log('\nWarnings are expected outside service hours — check them if a stop should be live.');
