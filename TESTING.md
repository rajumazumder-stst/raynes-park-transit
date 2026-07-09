# Testing changes without touching the live app

The live app redeploys on every push to `main`. The whole point of this process is
that **`main` is the only branch that can do that** — everything else gets its own
throwaway URL.

```
feature branch ──push──► Vercel preview URL ──smoke test──► review ──approval──► merge ──► production
                              (isolated)                                                      (live)
```

> **Deployment policy.** Unless explicitly stated otherwise, every change ships to a
> preview first. The live app is updated only after the repository owner has reviewed
> that preview and approved it. "Update the app" means *update the preview*. The merge
> step needs an explicit go-ahead — it is never implied by the request that produced
> the change.

---

## One-time setup

```bash
npx vercel login
npx vercel link          # connect this directory to the Vercel project
```

`vercel link` writes a `.vercel/` directory. It's gitignored.

### Check env vars are scoped to Preview and Development

This is the one thing that catches people out. If `TFL_KEY` and `LDBWS_TOKEN` are
set **only** for the Production environment, then every preview deployment and
every `vercel dev` run returns:

```json
{ "error": "TFL_KEY env var not set" }
```

…because [`api/tfl.js:9`](api/tfl.js#L9) and [`api/trains.js:8`](api/trains.js#L8)
guard on those exact names. Verify with:

```bash
npx vercel env ls
```

Both keys should be listed against Production, Preview **and** Development. Add any
that are missing:

```bash
npx vercel env add TFL_KEY preview
npx vercel env add TFL_KEY development
```

> The local `.env` in this repo defines `TFL_KEY_1`, `TFL_KEY_2`, `LDBWS_TOKEN_1`,
> `LDBWS_TOKEN_2` — none of which match the names the functions read. It predates
> this process and is **not** used by `vercel dev`. Use `vercel env pull` instead.

---

## The loop

### 1. Branch

```bash
git checkout -b add-merton-park-stop
```

Never commit directly to `main`. A branch push cannot reach production.

### 2. Run it locally

```bash
npx vercel env pull .env.local    # fetches Development env vars
npx vercel dev                    # → http://localhost:3000
```

`vercel dev` serves `public/` **and** executes `api/*.js` in the real Vercel
runtime, honouring the rewrites in `vercel.json`. Opening `public/index.html`
directly in a browser will not work — the `/api/*` calls have nothing to answer
them.

### 3. Smoke-test the data layer

```bash
node smoke.mjs                    # defaults to http://localhost:3000
```

`smoke.mjs` reads the `LOCATIONS` array straight out of `public/index.html`, so it
always tests exactly the stops the app is configured to render — add a stop to the
config and it's covered on the next run, with no edit to the test. It checks:

| Check | Fails when |
|---|---|
| Proxy guard | `api/tfl.js`'s `ALLOWED` regex stops rejecting arbitrary paths, path traversal, or full URLs. This regex is the only thing preventing the proxy relaying your TfL key. |
| Bus stops | Any NaPTAN in `LOCATIONS` returns a non-200 or a non-array payload |
| Tube / tram | Any `line`+`stopId` pair returns a non-200 or a non-array payload |
| National Rail | Any CRS returns a non-200, or a body missing the `{services, messages}` shape that `trains.js` promises, or services missing `serviceId` |
| Highlight | `filterCrs` is ignored (returns more rows than unfiltered), or its `serviceId`s don't intersect the unfiltered board — which would silently break the ★ badge |

**Zero arrivals is a warning, never a failure.** Outside service hours every stop is
legitimately empty, so a smoke test that failed on an empty board would be useless at
night.

A stop reporting no arrivals *and* no `Closure` record during service hours is worth
investigating: it usually means the NaPTAN is stale rather than the stop being shut.
`490010295E` ("Norbiton Church") was exactly this — still listed in TfL's line stop
lists, route sequences and timetables, `status: true`, no disruption record, yet never
issued a live prediction, because the routes had moved to `490013664C1` 176 m east.
It was removed from the config rather than fixed. Cross-check a suspect stop against
its neighbours with `/naptan-test.html` before assuming TfL is at fault.

Exit code is `0` when nothing failed, `1` otherwise, so it drops straight into CI.

### 4. Push and get a preview URL

```bash
git push -u origin add-merton-park-stop
```

Vercel builds a **preview deployment** on its own URL. Production is untouched. Find
the URL without leaving the terminal:

```bash
SHA=$(git rev-parse HEAD)
gh api "repos/rajumazumder-stst/raynes-park-transit/deployments?sha=$SHA" --jq '.[].id' \
  | xargs -I{} gh api "repos/rajumazumder-stst/raynes-park-transit/deployments/{}/statuses" \
      --jq '.[] | "\(.state)  \(.environment)  \(.environment_url)"'
```

**Preview URLs are behind Vercel Deployment Protection.** Opening one in a browser
signed in to the Vercel account works normally — that's how you eyeball a change. But
every *unauthenticated* request 302s to `vercel.com/sso-api`, so a script can't test
it out of the box. `smoke.mjs` detects this and says so rather than emitting dozens of
bogus failures.

Two ways to smoke-test a preview:

```bash
# 1. Bypass token — Vercel → Settings → Deployment Protection
#                 → Protection Bypass for Automation
VERCEL_AUTOMATION_BYPASS_SECRET=<token> node smoke.mjs <preview-url>

# 2. Or just test locally, where no protection applies
npx vercel dev && node smoke.mjs
```

Note that `smoke.mjs` reads the stop list from your **local** `public/index.html` while
calling the **deployed** API. That's deliberate: both functions are stateless proxies,
so this tells you whether the config you are about to ship works against the live
upstreams.

### 5. Eyeball it

The smoke test proves the data layer answers. It does not prove the app *renders*.
For anything touching rendering, open the preview URL and check the affected
location, plus the diagnostic pages, which work against any deployment:

- `/naptan-test.html` — every bus NaPTAN, closures, arrivals within 30 min
- `/clj-test.html` — Clapham Junction grouping and filter debug
- `/highlight-test.html` — `filterCrs` highlight detection for RAY/WBO

### 6. Merge

Merging the PR into `main` is the *only* action that touches the live app.

---

## Guarding `main`

Two settings make the process hard to bypass by accident:

- **GitHub** → Settings → Branches → add a protection rule on `main` requiring a
  pull request. This stops `git push origin main`.
- **Vercel** → Settings → Git → confirm Production Branch is `main`, so no other
  branch can ever promote itself to production.

---

## Rolling back

If something does reach production and it's wrong, don't scramble to fix forward.
Vercel keeps every previous deployment: **Vercel dashboard → Deployments → find the
last good one → Promote to Production.** It's instant and doesn't need a git commit.

---

## Notes

- There is deliberately **no `package.json`**. This is a zero-build static site plus
  two functions, and Vercel's zero-config detection handles it. Adding a manifest
  would introduce an install/build step to production for no gain. `smoke.mjs` uses
  only Node built-ins and needs no dependencies.
- `smoke.mjs` hits the real TfL and National Rail APIs, so each run consumes a modest
  amount of quota. It's bounded to 4 concurrent requests to stay well clear of rate
  limits.
