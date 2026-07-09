# Raynes Park Transit — Claude Code Context

A single-file PWA displaying live bus, National Rail, tube, and tram departures for South London locations, hosted on Vercel with a serverless backend.

## Repository

- **GitHub**: https://github.com/rajumazumder-stst/raynes-park-transit
- **Live app**: https://raynes-park-transit.vercel.app
- **Test app**: https://raynes-park-transit-git-preview-rajumazumder-ststs-projects.vercel.app — the `preview` branch, always at its latest commit
- **Deploy**: merge to `main` → Vercel auto-redeploys in ~30 s

### Deployment policy

> **Unless explicitly stated otherwise, every change ships to a test version first.
> The live app is updated only after the repository owner has reviewed the preview
> and approved it.**

This is not a style preference — treat it as a hard constraint:

- Never commit to `main`. Never merge a PR without being asked to.
- Work on the `preview` branch (or another branch of **≤ 11 characters**, so Vercel's
  static alias fits); push it and hand the test URL over for review.
- "Update the app" means *update the preview*. Only an explicit approval ("merge it",
  "ship it", "push to live") authorises touching `main`.
- If a task seems to require deploying live, stop and ask.

Process detail, env-var scoping and rollback: see `TESTING.md`.

## File structure

```
public/index.html          Single-file PWA (all HTML + CSS + JS)
public/clj-test.html       Diagnostic page — CLJ departures with grouped view, filter debug, and stats
public/highlight-test.html Test page — verifies filterCrs approach and RAY/WBO highlight detection
public/naptan-test.html    Test page — lists all bus-stop NaPTANs; lookup box + "Test All" sweep showing stop details, closures, and arrivals within 30 min
api/tfl.js                 Vercel serverless function — TfL proxy: arrivals (buses, tube, tram), stop-point disruptions, line timetables
api/trains.js              Vercel serverless function — National Rail REST proxy (GetDepartureBoard)
smoke.mjs                  Smoke test — parses LOCATIONS from index.html, exercises both APIs; takes a base URL, exits 1 on failure
TESTING.md                 Branch → preview → PR process; env-var scoping; rollback
vercel.json                Routing config (do not modify)
```

## APIs

| API | Purpose | Key / Token |
|-----|---------|-------------|
| TfL Open Data | Buses, tube, tram arrivals | `$TFL_KEY` (Vercel env var) |
| National Rail LDBWS | Train departures | `$LDBWS_TOKEN` (Vercel env var) |

- NR REST base: `https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120`
- NR auth: `x-apikey` request header (raildata.org.uk consumer key)
- `trains.js` called as `/api/trains?crs=RAY&rows=150` — `rows` is capped at 150, `timeWindow` is fixed at 30 min. Also supports `filterCrs=RAY` to return only services calling at that station.
- `trains.js` **normalises** the LDBWS payload; it does not pass it through. Response shape:

  ```js
  { services: [{ platform, std, etd, destination, operatorCode, serviceId }],
    messages: [ '...' ] }   // nrccMessages
  ```

  There is no `trainServices` or `generatedAt` in the response. `destination` is flattened from `destination[0].locationName`; `serviceId` is LDBWS's `serviceID` (note the casing change) and is what highlight matching keys on.

- `tfl.js` allows exactly four path shapes; anything else → 400:
  - `StopPoint/{naptan}/Arrivals`
  - `StopPoint/{naptan}/Disruption`
  - `Line/{line}/Arrivals/{stopId}`
  - `Line/{line}/Timetable/{stopId}` — scheduled departures, used by terminus boards

  The `ALLOWED` regex is anchored and is the only thing preventing the proxy from relaying `$TFL_KEY` to arbitrary URLs. If you add a path shape, keep every alternative fully bounded with `[^/]+` and never introduce `.*`; then confirm it still rejects `Line/Meta/Modes`, traversal (`.../../...`), extra path segments, and absolute URLs.

---

## Architecture

### Navigation

A single dropdown selector with `‹` `›` prev/next arrow buttons and a `↻` refresh button. 15 locations in order:

> Raynes Park, Wimbledon Chase, London Waterloo, Vauxhall, New Malden, Wimbledon, South Wimbledon, Colliers Wood, Norbiton, Clapham Junction, Kingston, Putney, Staines, Blackfriars, Waterloo East

### Skeleton-first rendering

`init()` builds all 15 location panels into the DOM before any fetch runs, using `buildPanelSkeleton(loc)`. Each transport section gets a stable container:

- `#nr-{id}` — National Rail
- `#tube-{id}` — Tube
- `#tram-{id}` — Trams
- `#deps-{stopKey}` — each individual bus stop

`fetchAll(id)` fires NR + tube + tram + all bus stops in parallel via `Promise.allSettled`. Each writer targets only its own container — no section can overwrite another.

### Section order per location

National Rail → Tube → Tram → Buses (only sections present in the location's config are rendered). Each section has a labelled horizontal rule divider.

### Filter bar (NR sections)

- **"To Raynes Park / Wimbledon Chase" highlight button** — shown on all NR locations except Raynes Park (RAY) and Wimbledon Chase (WBO). When toggled on, fetches highlight IDs via `filterCrs` and re-renders with a green ★ badge on matching rows. All services remain visible (no filtering).
- **Grouped / By Platform segmented control** — shown on all NR locations with `nr.groups` defined.

Both rendered inside `.filter-bar` above `#nr-{id}`.

### Times

All times in UK local time (BST/GMT) via `Europe/London` timezone using `toLocaleTimeString`. `minsFromNow()` handles both ISO timestamps (TfL) and `HH:MM` strings (National Rail).

---

## Data Config — `LOCATIONS` array

Single unified array. Each entry:

```js
{
  id,    // kebab-case string, used in DOM IDs
  name,  // display name in dropdown

  nr: {                          // omit if no NR station
    crs,                         // 3-letter CRS code
    groups: [{ label, plats[] }],// grouped view card definitions
    dynamicGroups,               // bool — enables destination-based routing (Vauxhall)
    dynamicPlatforms,            // { platNum: { opCode: groupLabel } } — operator routing (CLJ plat 17)
  },

  tube: [                        // omit if no tube; array to support multiple lines
    { line, stopId, label, pillClass, timetable? }
    // timetable: true — also fetch Line/{line}/Timetable/{stopId} and render a
    //                   scheduled-departures card (terminus stations only)
  ],

  tram: [                        // omit if no tram
    { line, stopId, label, pillClass, inboundOnly? }
  ],

  buses: {                       // omit if no buses
    flat: true, stops: [...]     // flat layout (two-column grid)
    // OR
    subgroups: [                 // collapsible subgroup layout
      { id, name, defaultOpen, stops: [...] }
    ]
  }
}
```

Each bus stop object:

```js
{ key, naptan, name, sub, routes, letter?, filterDest? }
// key        — unique string used in DOM IDs and STOP_MAP
// naptan     — NaPTAN ID passed to TfL Arrivals API
// letter     — badge label; if omitted, derived from key suffix; '' renders empty gradient badge
// filterDest — optional; arrivals whose destinationName exactly equals this string are dropped (this stop only)
```

### Location summary

| # | Location | NR (CRS) | Tube | Tram | Buses |
|---|----------|----------|------|------|-------|
| 1 | Raynes Park | RAY | — | — | 3 subgroups |
| 2 | Wimbledon Chase | WBO | — | — | flat |
| 3 | London Waterloo | WAT | Jubilee · Bakerloo · Northern · W&C | — | — |
| 4 | Vauxhall | VXH (dynamic) | Victoria | — | — |
| 5 | New Malden | NEM | — | — | 2 subgroups |
| 6 | Wimbledon | WIM | District | Tramlink (940GZZCRWMB) | 2 subgroups |
| 7 | South Wimbledon | — | Northern | Merton Park (inboundOnly) | flat (2 stops) |
| 8 | Colliers Wood | — | Northern | — | flat |
| 9 | Norbiton | NBT | — | — | flat (2 stops) |
| 10 | Clapham Junction | CLJ (dynamic) | — | — | flat (2 stops, `filterDest`) |
| 11 | Kingston | KNG | — | — | 2 subgroups |
| 12 | Putney | PUT | District | — | flat |
| 13 | Staines | SNS | — | — | — |
| 14 | Blackfriars | BFR | District + Circle | — | — |
| 15 | Waterloo East | WAE | — | — | — |

### NR groups

`groups` defines the labelled platform cards shown in grouped view. `plats: []` is a dynamic placeholder (Vauxhall). `dynamicGroups: true` activates destination-based routing (Vauxhall). `dynamicPlatforms` routes specific platforms by operator code (CLJ platform 17).

### Platform sort order

Default: numerical, TBA last, letters alphabetical. Per-station first-platform overrides:

```js
const PLAT_FIRST = { VXH:['8'], CLJ:['11'], WIM:['8'], KNG:['3'] };
```

### NR time window

30 minutes (`mins > 30` rows are discarded).

### Tube / tram time window

15 minutes (`mins > 15` rows are discarded).

### Highlight logic

The "To Raynes Park / Wimbledon Chase" button (shown on all NR locations except RAY and WBO) toggles highlight mode. When active:

1. Two parallel `GetDepartureBoard` requests are fired via `/api/trains` with `filterCrs=RAY` and `filterCrs=WBO`, returning only services that call at those stops.
2. The union of their `serviceId` values is stored as a `Set` in `S.highlightIds[id]`.
3. `renderNRData` sets `row.isHighlight = S.highlightIds[id].has(svc.serviceId)`.
4. `depRow` reads `r.isHighlight` to apply the green ★ badge and highlighted row style.
5. On auto-refresh, if `S.highlightActive[id]` is true, highlight IDs are re-fetched before rendering.

All services remain visible regardless of highlight state — no rows are filtered out.

---

## Config constants

```js
const PLAT_FIRST = { VXH:['8'], CLJ:['11'], WIM:['8'], KNG:['3'] };
const OP_PILL    = { SW:'pill-SW', TL:'pill-TL', SN:'pill-SN', SE:'pill-SE', LO:'pill-LO', GX:'pill-GX' };
const OP_ALIAS   = { CS:'SW', VT:'SW', XR:'SW' };   // operators borrowing another's pill
```

`opCode(svc)` resolves a service to its pill code: uppercase the operator field, follow
`OP_ALIAS` if present, then return it only if `OP_PILL` has it (otherwise `''` → blank pill).
Codes already in `OP_PILL` map to themselves and need no `OP_ALIAS` entry.

### Operator codes

| Code | Operator | Pill colour |
|------|----------|-------------|
| SW | South Western Railway | Amber |
| TL | Thameslink | Blue |
| SN | Southern | Green |
| SE | Southeastern | Blue |
| LO | London Overground | Orange |
| GX | Gatwick Express | Purple |

Fallback: blank pill if code not in `OP_PILL`.

### Tube / tram pill classes

Solid colour blocks, no text:

| Line | CSS var / colour |
|------|-----------------|
| District | `--district` #007D32 |
| Tramlink | `--tramlink` #5FB526 |
| Victoria | `--victoria` #0098D4 |
| Jubilee | `--jubilee` #868F98 |
| Bakerloo | `--bakerloo` #894E24 |
| Northern | `--northern` #1a1a1a |
| Waterloo & City | `--wc` #6BCDB2 |
| Circle | #FFD329 |

---

## State object

```js
const S = {
  currentIdx:     0,     // index into LOCATIONS
  highlightActive: {},   // locId → bool (highlight button toggled on)
  highlightIds:   {},    // locId → Set<serviceId> of services calling at RAY or WBO
  viewMode:       {},    // locId → 'grouped' | 'platform'
  nrCache:        {},    // locId → raw NR API response
  ttCache:        {},    // 'line|stopId' → raw TfL Timetable payload, or null on failure
};
```

---

## Key functions

### Shared plumbing

Written once, used everywhere. Prefer these over hand-rolling a `fetch` or a `<div class="state-row">`.

| Helper | Purpose |
|--------|---------|
| `apiJSON(url, ms)` | The only place a backend call is made: timeout, HTTP status check, and the `{error}` envelope both functions return. Throws `HTTP {status}` on a bad status. |
| `tflGet(path, ms)` / `nrGet(crs, extra)` | Thin wrappers over `apiJSON` for the two backends |
| `renderInto(elId, produce, errMsg)` | Owns a section's loading → content → error lifecycle |
| `withSpin(btn, fn)` | Spins a `↻` button for the duration of an async action, including on throw |
| `stateRow(text, danger)` | The one-line `state-row` markup; `errorHTML` is `stateRow(msg, true)` |
| `ukTime(d)` | `Europe/London` `HH:MM`; used by the clock, `setUpdated` and `fmtTime` |
| `platNum(name)` | Trailing platform number from a `platformName` (`"Eastbound - Platform 4"` → `"4"`) |
| `byMins` | The `(a,b)=>a.mins-b.mins` sort comparator |
| `realPlats(byPlat)` | Platform keys excluding the synthetic `_dyn_{label}` buckets |
| `routeDynamic(byPlat, plats, labelOf)` | Moves rows off real platforms into `_dyn_{label}` buckets; used by both CLJ operator routing and Vauxhall destination routing |
| `isHttpError(e)` | True for errors `apiJSON` raised from a bad status, as opposed to network/timeout failures |

**`fetchLineArrivals` error semantics are deliberate.** A line the API rejects (4xx/5xx)
contributes `[]`, so one dead line cannot blank a merged section like Blackfriars. A
network failure or timeout still rejects, so a total outage renders "Could not load…"
rather than the lie "No upcoming arrivals".

### Everything else

| Function | Purpose |
|----------|---------|
| `getAllBusStops(loc)` | Returns flat array of all bus stops for a location |
| `buildPanelSkeleton(loc)` | Builds full location panel HTML (all section containers) |
| `buildBusSkeleton(loc)` | Builds bus stop cards with `#deps-{key}` containers |
| `stopCardHTML(s)` | Single bus stop card HTML |
| `init()` | Builds all panels + dropdown, calls `fetchAll` for first location |
| `selectLocation(id)` | Switches active panel, calls `fetchAll` |
| `navStep(dir)` | Prev/next navigation with wraparound |
| `refreshCurrent()` | Spins ↻ button, awaits `fetchAll` for current location |
| `fetchAll(id)` | Fires NR + tube + tram + all bus stops in parallel via `Promise.allSettled` |
| `fetchAndRenderNR(loc)` | Fetches `/api/trains`, writes to `#nr-{id}` only |
| `fetchHighlightIds(crs)` | Fetches `filterCrs=RAY` and `filterCrs=WBO` boards in parallel; returns `Set<serviceId>` |
| `renderNRData(loc, nrData)` | Full NR render: dynamic routing, grouped/platform view, alert banner |
| `fetchLineArrivals(items)` | Shared TfL fetch: maps array of `{line,stopId}` configs to arrival arrays |
| `fetchAndRenderTube(loc)` | Fetches TfL tube arrivals via `fetchLineArrivals`, writes to `#tube-{id}` only |
| `fetchTimetable(line, stopId)` | Fetches `Line/{line}/Timetable/{stopId}` once and caches in `S.ttCache` (static for the day); resolves `null` on failure so the arrivals card still renders |
| `renderTubeData(loc, tubeData, timetables)` | Handles `mergeLines` (Blackfriars), Wimbledon terminus (two cards), standard |
| `dedupeTerminusArrivals(arrivals)` | Collapses TfL's per-platform duplicate predictions at a terminus into one entry per train; returns `{arrival, plat}[]` sorted by `timeToStation`, `plat === null` when TfL has not assigned one |
| `scheduledDepartures(tt, windowMins)` | Timetable payload → `{mins, time, dest}[]` within the window. Handles the string/number `intervalId` mismatch and `hour >= 24` (post-midnight) |
| `fetchAndRenderTram(loc)` | Fetches TfL tram arrivals via `fetchLineArrivals`, writes to `#tram-{id}` only |
| `renderTramData(loc, tramData)` | Handles `inboundOnly` flag (Merton Park) |
| `fetchBusStop(key)` | Fetches TfL arrivals, writes to `#deps-{key}` only; drops arrivals matching `stop.filterDest`; if no arrivals, checks closure via `fetchBusClosure` |
| `fetchBusClosure(naptan)` | Fetches `StopPoint/{naptan}/Disruption`; returns the active `type:"Closure"` record (latest reopen date) or `null` |
| `refreshBusStop(key)` | Spins per-stop ↻, calls `fetchBusStop` |
| `buildCard(label, chips, rows, type, sub)` | Shared card HTML builder for NR/tube/tram |
| `tflRow(a, pillClass)` | Shared TfL arrival → row mapper for tube/tram; returns `null` if outside the 15-min window (callers override `plat` as needed) |
| `depRow(r, type)` | Single departure row HTML |
| `renderRows(rows, type)` | Maps rows to `depRow` HTML |
| `toggleHighlight(id)` | Toggles highlight button, fetches highlight IDs via `filterCrs`, re-renders NR section |
| `setViewMode(id, mode)` | Switches grouped/platform, re-renders NR from cache |
| `toggleSubgroup(header)` | Collapses/expands bus subgroup |
| `classifyVXH(row)` | Vauxhall dynamic group classifier |

---

## Special rendering rules

- **Wimbledon District line** — terminus. Rendered as **two cards**, each independently sourced and internally truthful. They are deliberately *not* joined.

  **Arriving (live)** — deduped via `dedupeTerminusArrivals`. TfL emits one prediction *per candidate platform* for any train it has not yet berthed, so one train would otherwise appear four times (a sampled 22 raw predictions described only 7 trains). The destination column would read `"Wimbledon Underground Station"` on every row — these are arrivals *into* the terminus — so it shows `currentLocation` instead, which is real data and useful here.

  A platform is shown **iff all of a train's predictions name the same platform**; otherwise the row reads `TBA` (via `row.platTBA`). Note this is a statement about the predictions, *not* about `currentLocation`: a train reporting `"At Platform"` has been observed still emitting predictions on two platforms at once (vehicle `002`, Platforms 1 and 4). Do not assume berthed implies a known platform.

  Clustering by prediction `id` alone is **not** sufficient: unassigned trains all carry `vehicleId: "000"` and their `id` hash collides across different trains. A platform repeating within one `id` marks the boundary between two trains.

  **Departing (scheduled)** — `scheduledDepartures()` over `Line/district/Timetable/940GZZLUWIM`, 30-min window, capped at 6 rows. The only source of real destinations at this station. Captioned "not adjusted for delays". Renders even when nothing is inbound.

  **Why they are not joined.** A hybrid (live times + destination from the nearest timetable slot) was prototyped and rejected. TfL's `timeToStation` values are front-loaded: sampled three times, 6 trains are predicted inside the 15-minute window against only 3 booked departures, converging only over ~45 min. Departures from Wimbledon strictly alternate Tower Hill / Edgware Road, so a slot assignment drifting by one flips *every* destination at once — plausible-looking and wrong. Do not re-attempt this without new evidence that arrival predictions are reliable.
- **Blackfriars tube** — District + Circle merged into shared Eastbound/Westbound cards by `platformName` (`mergeLines` path)
- **London Waterloo tube** — 4 lines rendered independently by `platformName` (not merged, because `crs === 'WAT'` skips `mergeLines`)
- **Vauxhall NR** — platforms not in `['6','8']` routed dynamically by destination: contains "London Waterloo" → London Waterloo group, others → Waterloo-Reading line group
- **Clapham Junction platform 17** — SN services → Brighton Main Line, LO services → London Overground (via `dynamicPlatforms`)
- **Merton Park tram (South Wimbledon)** — fetched via `Line/tram/Arrivals`, filtered to `direction === 'inbound'` via `inboundOnly: true`
- **Clapham Junction buses** — both stops set `filterDest:'Clapham Junction'`, so buses terminating at Clapham Junction (e.g. 35, 39, 49, 295, C3) are dropped from the live list; this flag is per-stop and affects no other location
- **Bus stops with no letter** — `letter: ''` renders an empty gradient badge
- **Closed bus stops** — when a stop returns no arrivals, `fetchBusStop` checks `StopPoint/{naptan}/Disruption`. A `type:"Closure"` record renders a red "Stop closed until {date}" notice; stops with no arrivals and no closure record keep the neutral "No upcoming departures" state. TfL only flags temporary hooded closures this way.

- **Stale NaPTANs — HYPOTHESIS, not established fact.** Further investigation pending.

  **Observed** (verified against the API): `490010295E` ("Norbiton Church") returned zero arrivals via every endpoint shape, while all seven bus stops within 350 m returned between 2 and 13. It carried `status: true`, an empty `/Disruption` array, membership in all five of its lines' `StopPoints`, a place in line 57's operational `Route/Sequence`, and a full `Timetable` of 103 journeys. Its actual line list (57, 85, K2, K3, K4) did not match the config's (57, 85, 213, 371, K2, K3, K4, K5); those routes serve `490013664C1` ("Tiffin School / London Road") 176 m east, which is live.

  **Inferred, and unproven**: that TfL retires a stop from the live prediction feed while leaving it in reference data, and that this stop was renamed or relocated. The API never states this. The distance and name change are suggestive, not conclusive; a single stop is not a pattern.

  **Do not yet treat "no arrivals + no `Closure` record" as diagnostic of a stale NaPTAN.** Cross-check against neighbouring stops and, where possible, against TfL's own journey planner or on-street signage. Revisit when more instances have been gathered.

---

## Auto-refresh

Every 30 seconds, `fetchAll` is called for whichever location is currently active:

```js
setInterval(() => fetchAll(LOCATIONS[S.currentIdx].id), 30000);
```

---

## Design system

| Token | Value |
|-------|-------|
| Background | `#060c18` |
| Card | `#0e1828` |
| Card header | `#132035` |
| Border | `#1e3050` |
| Accent blue | `#2a7fff` |
| Accent teal | `#00c9a7` |
| Accent amber | `#ffb340` |
| Accent red | `#ff4d6a` |
| Accent green | `#00e676` |
| Font mono | Space Mono |
| Font body | DM Sans |
| Minutes: due | red (`≤ 3 min`) |
| Minutes: soon | amber (`4–8 min`) |
| Minutes: normal | teal (`9+ min`) |
| Grid | Two-column for bus stop cards on screens ≥ 640 px |

---

## Version display

On init, `index.html` fetches its own `Last-Modified` header via a `HEAD` request and displays it as the version string in the header (e.g. `Version: 17 Jun 2025 14:30`).

---

## Known pending improvements

1. **Stale NaPTAN hypothesis** — see *Stale NaPTANs* above. One instance (`490010295E`) is not a pattern. Gather further examples and confirm the mechanism before the rule is relied upon, or before building any automated detection on top of it.

2. **"Check Front of Train" at Putney** — some arrivals carry no `destinationName`, so `tflRow`'s `destinationName || towards` fallback renders TfL's literal placeholder as the destination, and again as the note. Wimbledon no longer shows this (its Arriving card overrides `dest` with `currentLocation`), but **Putney does**: `Line/district/Arrivals/940GZZLUEPY` had 2 of 4 arrivals in this state when last checked. Blackfriars is unaffected — its instances are Hammersmith & City trains, and the app fetches only `district` and `circle` there.

3. **Operator codes at Clapham Junction** — `operatorCode` field not always populated by NR API; can cause incorrect pill or routing for platform 17

4. **Operator code diagnostic page** — `public/operator-code-test.html` (not yet built): one station at a time, showing raw `operatorCode` and mapped pill value

5. **Version timestamp** — verify `Last-Modified` header updates correctly after each Vercel deployment

6. **`naptan-test.html` duplicates the stop list** — it hardcodes its own copy of every bus stop rather than reading `LOCATIONS`. The two drifted once already (it was missing both Clapham Junction stops). Adding or removing a bus stop means editing **both** files.

---

## Working conventions

- **Never commit to `main`, and never merge without explicit approval.** See *Deployment policy* above. Work on a branch, push for a preview URL, hand it over for review.
- **Verify before pushing**: `node smoke.mjs` against `npx vercel dev`. It parses `LOCATIONS` out of `index.html`, so new stops and any `timetable:true` tube stop are covered automatically. Exits 1 on failure. Named targets: `node smoke.mjs [local|preview|prod|<url>]`.
- **A new `tfl.js` path fails `smoke.mjs` against a deployment that predates it.** The test calls the *deployed* backend while reading the *local* config, so widening `ALLOWED` shows up as a failure against `prod` until the change is merged. That is the check working, not a defect.
- **Config-only changes** (adding stops, reordering, relabelling): edit the `LOCATIONS` array — and `naptan-test.html`, which keeps its own copy (see known issue 6).
- **Logic changes**: identify the relevant function and explain what is changing and why before editing.
- **File destinations**: `index.html` → `public/`, `trains.js` / `tfl.js` → `api/`
- **API compatibility**: `trains.js`'s call signature and its `{services, messages}` response shape are stable. Front-end changes should not require backend changes unless a new TfL path shape is needed, which means editing `tfl.js`'s `ALLOWED` regex.
- **Before trusting a stop that returns nothing**, check whether its NaPTAN is stale rather than closed (see *Stale NaPTANs* above). TfL reference data outlives the live feed.
