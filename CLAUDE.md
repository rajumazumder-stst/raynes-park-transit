# Raynes Park Transit — Claude Code Context

A single-file PWA displaying live bus, National Rail, tube, and tram departures for South London locations, hosted on Vercel with a serverless backend.

## Repository

- **GitHub**: https://github.com/rajumazumder-stst/raynes-park-transit
- **Live app**: https://raynes-park-transit.vercel.app
- **Deploy**: push to `main` → Vercel auto-redeploys in ~30 s

## File structure

```
public/index.html          Single-file PWA (all HTML + CSS + JS)
public/clj-test.html       Diagnostic page — CLJ departures with grouped view, filter debug, and stats
public/highlight-test.html Test page — verifies filterCrs approach and RAY/WBO highlight detection
api/tfl.js                 Vercel serverless function — TfL arrivals proxy (buses, tube, tram)
api/trains.js              Vercel serverless function — National Rail REST proxy (GetDepartureBoard)
vercel.json                Routing config (do not modify)
```

## APIs

| API | Purpose | Key / Token |
|-----|---------|-------------|
| TfL Open Data | Buses, tube, tram arrivals | `$TFL_KEY` (Vercel env var) |
| National Rail LDBWS | Train departures | `$LDBWS_TOKEN` (Vercel env var) |

- NR REST base: `https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120`
- NR auth: `x-apikey` request header (raildata.org.uk consumer key)
- `trains.js` called as `/api/trains?crs=RAY&rows=150` — returns up to 149 services; also supports `filterCrs=RAY` to return only services calling at that station
- `tfl.js` called as `/api/tfl?path=StopPoint/{naptan}/Arrivals` or `/api/tfl?path=Line/{line}/Arrivals/{stopId}`

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
{ key, naptan, name, sub, routes, letter? }
// key    — unique string used in DOM IDs and STOP_MAP
// naptan — NaPTAN ID passed to TfL Arrivals API
// letter — badge label; if omitted, derived from key suffix; '' renders empty gradient badge
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
| 7 | South Wimbledon | — | Northern | Merton Park (inboundOnly) | 1 flat stop |
| 8 | Colliers Wood | — | Northern | — | flat |
| 9 | Norbiton | NBT | — | — | flat |
| 10 | Clapham Junction | CLJ (dynamic) | — | — | — |
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
| `renderTubeData(loc, tubeData)` | Handles `mergeLines` (Blackfriars), Wimbledon combined, standard |
| `fetchAndRenderTram(loc)` | Fetches TfL tram arrivals via `fetchLineArrivals`, writes to `#tram-{id}` only |
| `renderTramData(loc, tramData)` | Handles `inboundOnly` flag (Merton Park) |
| `fetchBusStop(key)` | Fetches TfL arrivals, writes to `#deps-{key}` only |
| `refreshBusStop(key)` | Spins per-stop ↻, calls `fetchBusStop` |
| `buildCard(label, chips, rows, type, sub)` | Shared card HTML builder for NR/tube/tram |
| `depRow(r, type)` | Single departure row HTML |
| `renderRows(rows, type)` | Maps rows to `depRow` HTML |
| `toggleHighlight(id)` | Toggles highlight button, fetches highlight IDs via `filterCrs`, re-renders NR section |
| `setViewMode(id, mode)` | Switches grouped/platform, re-renders NR from cache |
| `toggleSubgroup(header)` | Collapses/expands bus subgroup |
| `classifyVXH(row)` | Vauxhall dynamic group classifier |

---

## Special rendering rules

- **Wimbledon District line** — all 4 platforms combined into one card; platform number shown per row
- **Blackfriars tube** — District + Circle merged into shared Eastbound/Westbound cards by `platformName` (`mergeLines` path)
- **London Waterloo tube** — 4 lines rendered independently by `platformName` (not merged, because `crs === 'WAT'` skips `mergeLines`)
- **Vauxhall NR** — platforms not in `['6','8']` routed dynamically by destination: contains "London Waterloo" → London Waterloo group, others → Waterloo-Reading line group
- **Clapham Junction platform 17** — SN services → Brighton Main Line, LO services → London Overground (via `dynamicPlatforms`)
- **Merton Park tram (South Wimbledon)** — fetched via `Line/tram/Arrivals`, filtered to `direction === 'inbound'` via `inboundOnly: true`
- **Bus stops with no letter** — `letter: ''` renders an empty gradient badge

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

1. **Wimbledon District line destinations** — all westbound services show "Wimbledon" (TfL API limitation for terminus stations); needs investigation
2. **Operator codes at Clapham Junction** — `operatorCode` field not always populated by NR API; can cause incorrect pill or routing for platform 17
3. **Operator code diagnostic page** — `public/operator-code-test.html` (not yet built): one station at a time, showing raw `operatorCode` and mapped pill value
4. **Version timestamp** — verify `Last-Modified` header updates correctly after each Vercel deployment

---

## Working conventions

- **Config-only changes** (adding stops, reordering, relabelling): edit only the `LOCATIONS` array
- **Logic changes**: identify the relevant function and explain what is changing and why before editing
- **File destinations**: `index.html` → `public/`, `trains.js` → `api/`
- **Output**: produce the complete modified file ready to commit — not diffs
- **API compatibility**: `trains.js` call signature is stable; front-end changes should not require backend changes unless explicitly noted
