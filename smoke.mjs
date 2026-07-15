#!/usr/bin/env node
// Smoke test for the data layer. Run against a local `vercel dev` server, the
// static preview URL, production, or any explicit URL:
//
//   node smoke.mjs              # http://localhost:3000
//   node smoke.mjs preview      # the static `preview` branch alias
//   node smoke.mjs prod         # the live app
//   node smoke.mjs https://...  # anything else
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

// Named targets, so nobody has to paste a per-commit URL. `preview` is a Vercel
// branch alias: it always points at the newest commit on the `preview` branch.
const TARGETS = {
  local: 'http://localhost:3000',
  preview: 'https://raynes-park-transit-git-preview-rajumazumder-ststs-projects.vercel.app',
  prod: 'https://raynes-park-transit.vercel.app',
};

const arg = process.argv[2] || 'local';
const BASE = (TARGETS[arg] || arg).replace(/\/$/, '');
const ROOT = dirname(fileURLToPath(import.meta.url));
const CONCURRENCY = 4;

// Vercel preview deployments sit behind Deployment Protection (SSO), which 302s
// any unauthenticated request. Set a Protection Bypass token to test them:
//   Vercel → Settings → Deployment Protection → Protection Bypass for Automation
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

const pass = [];
const warn = [];
const fail = [];

const ok = (m) => { pass.push(m); console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const wr = (m) => { warn.push(m); console.log(`  \x1b[33m!\x1b[0m ${m}`); };
const no = (m) => { fail.push(m); console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

async function get(path) {
  const res = await fetch(BASE + path, {
    signal: AbortSignal.timeout(15000),
    redirect: 'manual', // so an SSO bounce surfaces as a 3xx rather than an HTML page
    headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {},
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON or empty body */ }
  return { status: res.status, body, location: res.headers.get('location') };
}

// Run tasks with a bounded worker pool so we don't trip TfL/NR rate limits.
async function pool(items, fn) {
  const queue = [...items];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

// A thrown check is a failed check, not a dead run.
const attempt = (label, fn) => fn().catch((e) => no(`${label} threw: ${e.message}`));

// Shared expectation: HTTP 200 whose body is an array. Returns it, or null having reported why not.
async function expectArray(path, label) {
  const { status, body } = await get(path);
  if (status !== 200) { no(`${label} → HTTP ${status}`); return null; }
  if (!Array.isArray(body)) { no(`${label} → payload is not an array`); return null; }
  return body;
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

  // entries carrying `timetable:true` need the Timetable path in tfl.js's ALLOWED regex;
  // `timetableDir` (trams at branch/terminus stops) rides through as a `direction` param
  const timetables = all(/line:'([^']+)',\s*stopId:'([^']+)'[^}]*timetable:\s*true(?:[^}]*timetableDir:'([^']+)')?/g)
    .map((m) => ({ line: m[1], stopId: m[2], direction: m[3] }));

  if (!naptans.length || !crs.length || !lines.length) {
    throw new Error('Parsed 0 of some config type from public/index.html — did the LOCATIONS format change?');
  }
  return { naptans, crs, lines, timetables };
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
  await pool(bad, ([label, path]) => attempt(label, async () => {
    const { status } = await get(path);
    status === 400
      ? ok(`rejects ${label} → 400`)
      : no(`${label} returned ${status}, expected 400 — proxy may be exploitable`);
  }));
}

async function checkBusStops(naptans) {
  console.log(`\nBus stops (${naptans.length} NaPTANs from LOCATIONS)`);
  await pool(naptans, (n) => attempt(n, async () => {
    const body = await expectArray(`/api/tfl?path=StopPoint/${n}/Arrivals`, n);
    if (!body) return;
    if (body.length) return ok(`${n} → ${body.length} arrivals`);

    // Zero arrivals: mirror fetchBusStop's closure lookup so an empty board
    // is explained rather than silently green.
    const d = await get(`/api/tfl?path=StopPoint/${n}/Disruption`);
    const closure = Array.isArray(d.body) && d.body.find((x) => x.type === 'Closure');
    wr(closure ? `${n} → 0 arrivals (CLOSED until ${closure.toDate || 'unknown'})` : `${n} → 0 arrivals, no closure record`);
  }));
}

async function checkLines(lines) {
  console.log(`\nTube / tram (${lines.length} line+stop pairs)`);
  await pool(lines, ({ line, stopId }) => {
    const label = `${line} @ ${stopId}`;
    return attempt(label, async () => {
      const body = await expectArray(`/api/tfl?path=Line/${line}/Arrivals/${stopId}`, label);
      if (!body) return;
      body.length ? ok(`${label} → ${body.length} arrivals`) : wr(`${label} → 0 arrivals`);
    });
  });
}

// api/trains.js normalises LDBWS into { services, messages } — it does NOT pass
// through trainServices/generatedAt. The front end reads only that shape.
async function checkTrains(crsList) {
  console.log(`\nNational Rail (${crsList.length} CRS codes)`);
  await pool(crsList, (crs) => attempt(crs, async () => {
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
  }));
}

// Terminus / branch departure boards read Line/{line}/Timetable/{stopId}. That path is a
// recent addition to tfl.js's ALLOWED regex, so a deployment predating it 400s. Branch stops
// (trams) also need `&direction=`; a deployment predating that returns a disambiguation.
async function checkTimetables(items) {
  if (!items.length) return;
  console.log(`\nTimetables (${items.length} departure board${items.length > 1 ? 's' : ''})`);
  for (const { line, stopId, direction } of items) {
    const label = `${line} @ ${stopId}${direction ? ` (${direction})` : ''}`;
    await attempt(label, async () => {
      const dirQuery = direction ? `&direction=${direction}` : '';
      const { status, body } = await get(`/api/tfl?path=Line/${line}/Timetable/${stopId}${dirQuery}`);
      if (status === 400) return no(`${label} → 400; this deployment's tfl.js ALLOWED regex lacks the Timetable path`);
      if (status !== 200) return no(`${label} → HTTP ${status}`);
      if (body?.disambiguation) return no(`${label} → disambiguation; this deployment's tfl.js lacks direction support`);
      const route = body?.timetable?.routes?.[0];
      if (!route?.schedules?.length) return no(`${label} → no schedules in payload`);
      if (!body?.stops?.length) return no(`${label} → no stops[]; destinations cannot be resolved to names`);

      // scheduledDepartures() joins String(stationIntervals[].id) to knownJourneys[].intervalId
      const ids = new Set((route.stationIntervals || []).map((si) => String(si.id)));
      const used = new Set((route.schedules[0].knownJourneys || []).map((j) => String(j.intervalId)));
      const orphan = [...used].filter((u) => !ids.has(u));
      if (orphan.length) return no(`${label} → intervalIds ${orphan.join(',')} have no stationInterval`);
      ok(`${label} → ${route.schedules.length} schedules, ${ids.size} destinations`);
    });
  }
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
console.log(`Smoke test → ${BASE}${BYPASS ? '  (protection bypass set)' : ''}`);

// Preflight. Without this, a protected preview turns every check into a bogus
// failure and buries the one thing you actually need to know.
try {
  const { status, location } = await get('/api/tfl');
  if (status >= 300 && status < 400 && /vercel\.com\/sso-api/.test(location || '')) {
    console.error(
      `\n\x1b[31m${BASE} is behind Vercel Deployment Protection.\x1b[0m\n` +
      `Every request 302s to Vercel SSO, so the API cannot be tested from a script.\n\n` +
      `The deployment is fine — open it in a browser signed in to your Vercel account.\n` +
      `To smoke-test it from here, create a bypass token:\n` +
      `  Vercel → Settings → Deployment Protection → Protection Bypass for Automation\n` +
      `then re-run with:\n` +
      `  VERCEL_AUTOMATION_BYPASS_SECRET=<token> node smoke.mjs ${BASE}\n\n` +
      `Or test the same code locally, where no protection applies:\n` +
      `  npx vercel dev  &&  node smoke.mjs\n`,
    );
    process.exit(1);
  }
  if (status !== 400) {
    console.error(`\n\x1b[31m${BASE}/api/tfl returned ${status}, expected 400.\x1b[0m Is this a deployment of this project?`);
    process.exit(1);
  }
} catch (e) {
  console.error(`\n\x1b[31mCannot reach ${BASE}\x1b[0m — is \`npx vercel dev\` running?\n  ${e.message}`);
  process.exit(1);
}

const { naptans, crs, lines, timetables } = await readConfig();

await checkProxyGuard();
await checkBusStops(naptans);
await checkLines(lines);
await checkTimetables(timetables);
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
