# Raynes Park Transit — Claude Code Context

A single-file PWA displaying live bus, National Rail, tube, and tram departures for South London locations, hosted on Vercel with a serverless backend.

## Repository

- **GitHub**: https://github.com/rajumazumder-stst/raynes-park-transit
- **Live app**: https://raynes-park-transit.vercel.app
- **Deploy**: merge to `main` → Vercel auto-redeploys in ~30 s
- **Testing**: never commit to `main` directly. Branch → `npx vercel dev` → `node smoke.mjs` → push for a Vercel preview URL → PR. See `TESTING.md`.

## File structure

```
public/index.html          Single-file PWA (all HTML + CSS + JS)
public/clj-test.html       Diagnostic page — CLJ departures with grouped view, filter debug, and stats
public/highlight-test.html Test page — verifies filterCrs approach and RAY/WBO highlight detection
public/naptan-test.html    Test page — lists all bus-stop NaPTANs; lookup box + "Test All" sweep showing stop details, closures, and arrivals within 30 min
api/tfl.js                 Vercel serverless function — TfL proxy: arrivals (buses, tube, tram) + stop-point disruptions
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

- `tfl.js` allows exactly three path shapes; anything else → 400:
  - `StopPoint/{naptan}/Arrivals`
  - `StopPoint/{naptan}/Disruption`
  - `Line/{line}/Arrivals/{stopId}`

  The `ALLOWED` regex is anchored and is the only thing preventing the proxy from relaying `$TFL_KEY` to arbitrary URLs. Adding a path shape (e.g. `Line/{line}/Timetable/{stopId}`) requires editing it.

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
    { line, stopId, label, pillClass }
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
const ATOC_MAP   = { SW:'SW', TL:'TL', SN:'SN', SE:'SE', LO:'LO', GX:'GX', CS:'SW', VT:'SW', XR:'SW' };
```

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
};
```

---

## Key functions

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
| `renderTubeData(loc, tubeData)` | Handles `mergeLines` (Blackfriars), Wimbledon combined + deduped, standard |
| `dedupeTerminusArrivals(arrivals)` | Collapses TfL's per-platform duplicate predictions at a terminus into one entry per train; returns `{arrival, plat}[]` sorted by `timeToStation`, `plat === null` when TfL has not assigned one |
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

- **Wimbledon District line** — terminus. All 4 platforms combined into one card, deduped via `dedupeTerminusArrivals`. TfL emits one prediction *per candidate platform* for any train it has not yet berthed, so one train would otherwise appear four times (a sampled 22 raw predictions described only 7 trains). A platform tag renders only when TfL has committed to a platform — i.e. the train reports `currentLocation: "At Platform"` and yields a single prediction. En-route trains show no platform.

  Clustering by prediction `id` alone is **not** sufficient: unassigned trains all carry `vehicleId: "000"` and their `id` hash collides across different trains. A platform repeating within one `id` marks the boundary between two trains.
- **Blackfriars tube** — District + Circle merged into shared Eastbound/Westbound cards by `platformName` (`mergeLines` path)
- **London Waterloo tube** — 4 lines rendered independently by `platformName` (not merged, because `crs === 'WAT'` skips `mergeLines`)
- **Vauxhall NR** — platforms not in `['6','8']` routed dynamically by destination: contains "London Waterloo" → London Waterloo group, others → Waterloo-Reading line group
- **Clapham Junction platform 17** — SN services → Brighton Main Line, LO services → London Overground (via `dynamicPlatforms`)
- **Merton Park tram (South Wimbledon)** — fetched via `Line/tram/Arrivals`, filtered to `direction === 'inbound'` via `inboundOnly: true`
- **Clapham Junction buses** — both stops set `filterDest:'Clapham Junction'`, so buses terminating at Clapham Junction (e.g. 35, 39, 49, 295, C3) are dropped from the live list; this flag is per-stop and affects no other location
- **Bus stops with no letter** — `letter: ''` renders an empty gradient badge
- **Closed bus stops** — when a stop returns no arrivals, `fetchBusStop` checks `StopPoint/{naptan}/Disruption`. A `type:"Closure"` record renders a red "Stop closed until {date}" notice; stops with no arrivals and no closure record keep the neutral "No upcoming departures" state. TfL only flags temporary hooded closures this way.

- **Stale NaPTANs** — a stop that returns no arrivals *and* no `Closure` record during service hours is usually a retired NaPTAN, not a closed stop. TfL keeps such IDs in its reference data (`status: true`, still listed in `Line/{line}/StopPoints`, still in `Route/Sequence`, still with a full `Timetable`) long after the live prediction feed has stopped publishing against them. `490010295E` ("Norbiton Church") was one: its real route list never matched the config's, because those routes had moved to `490013664C1` 176 m east. It was removed rather than repointed. Cross-check any suspect stop against its neighbours before blaming the API.

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

1. **Wimbledon District line destinations** — investigated; not an app bug and not fixable from the current endpoint.

   Every prediction at Wimbledon is an *arrival into* the terminus, so `destinationName` correctly reads `"Wimbledon Underground Station"`. `?direction=inbound|outbound` both return 0 rows, and `StopPoint/{id}/ArrivalDepartures` rejects the District line outright. The same feed is fully populated at non-terminus stations (Victoria shows Ealing Broadway, Upminster, Richmond).

   Real departure destinations exist only in `Line/district/Timetable/940GZZLUWIM`, reachable via `stationIntervals[].intervals[-1].stopId` keyed by `knownJourneys[].intervalId`. Two traps: `stationIntervals[].id` is a **string** while `intervalId` is an **int**, and the path is not in `tfl.js`'s `ALLOWED` regex — this would be the project's first backend change.

   Open design question: live arrivals (accurate timings, no destinations) vs scheduled departures (real destinations, no live adjustment).

2. **"Check Front of Train"** — trains already berthed at Wimbledon carry no `destinationName`, so `tflRow`'s `destinationName || towards` fallback renders TfL's literal placeholder string as the destination, and again as the note. Worth suppressing when the destination work above is done.

3. **Operator codes at Clapham Junction** — `operatorCode` field not always populated by NR API; can cause incorrect pill or routing for platform 17

4. **Operator code diagnostic page** — `public/operator-code-test.html` (not yet built): one station at a time, showing raw `operatorCode` and mapped pill value

5. **Version timestamp** — verify `Last-Modified` header updates correctly after each Vercel deployment

6. **`naptan-test.html` duplicates the stop list** — it hardcodes its own copy of every bus stop rather than reading `LOCATIONS`. The two drifted once already (it was missing both Clapham Junction stops). Adding or removing a bus stop means editing **both** files.

---

## Working conventions

- **Never commit to `main`.** `main` is the production branch; merging to it deploys. Work on a branch, push for a preview URL, open a PR. Full process in `TESTING.md`.
- **Verify before pushing**: `node smoke.mjs` against `npx vercel dev`. It parses `LOCATIONS` out of `index.html`, so new stops are covered automatically. Exits 1 on failure.
- **Config-only changes** (adding stops, reordering, relabelling): edit the `LOCATIONS` array — and `naptan-test.html`, which keeps its own copy (see known issue 6).
- **Logic changes**: identify the relevant function and explain what is changing and why before editing.
- **File destinations**: `index.html` → `public/`, `trains.js` / `tfl.js` → `api/`
- **API compatibility**: `trains.js`'s call signature and its `{services, messages}` response shape are stable. Front-end changes should not require backend changes unless a new TfL path shape is needed, which means editing `tfl.js`'s `ALLOWED` regex.
- **Before trusting a stop that returns nothing**, check whether its NaPTAN is stale rather than closed (see *Stale NaPTANs* above). TfL reference data outlives the live feed.
