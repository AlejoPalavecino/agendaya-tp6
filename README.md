# AgendaYA · TP6

A small, working availability-and-booking prototype for **Ingeniería y Calidad de Software, Grupo 01**. It implements the four mandatory TP6 flows from modules **M02 and M04**, with a responsive Spanish interface and a Node.js mini backend that runs locally or on Vercel.

> [!IMPORTANT]
> This is an **academic demo**, not a production booking service. The professional, service and notifications are simulated. Use fictitious guest data. The shared deployment has no authentication: anyone with its link can change availability and make mock bookings. Automated test authoring was explicitly deferred; no Cypress installation or test suite is included yet.

## Run locally

Requires **Node.js 24.x** with npm. No dependencies, installation or build step are needed.

```sh
npm start
```

Open **http://127.0.0.1:3000**. Stop the server with `Ctrl+C`.

```sh
npm run dev
```

Development mode restarts the Node server when server-side files change. Refresh the browser after editing frontend files. The application binds only to `127.0.0.1`; it is not exposed to the local network.

### Optional configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Local HTTP port |
| `AGENDA_DATA_FILE` | `data/agenda.json` inside the project | Alternate JSON file, useful for isolated future test runs |

PowerShell example:

```powershell
$env:PORT = '3001'
$env:AGENDA_DATA_FILE = Join-Path $PWD 'data/demo-alternative.json'
npm start
```

The data file is created on first startup. Configuration, blocked dates, pending holds and confirmed bookings survive server restarts. Do not run multiple server processes against the same data file.

### Reset demo data

**Stop the server first.** This explicitly removes every local booking and hold, clears blocked dates, and restores the fixture working week. It is not a production migration or an undo feature.

```sh
npm run reset -- --confirm
npm start
```

Reset without `--confirm` refuses to write. There is no browser-accessible reset endpoint. If using `AGENDA_DATA_FILE`, the reset command targets that file too. Runtime data is excluded from Git.

## Deploy the shared demo on Vercel

1. Import this GitHub repository into Vercel. Use the **Node.js** framework preset and the repository root; no custom build command or output directory is needed. `vercel.json` selects `iad1` and includes the allowlisted public assets in the native Node function.
2. Connect the **Upstash Redis Free** store to the project's **Production** environment (and **Preview** if previews are needed). The Marketplace provides **`KV_REST_API_URL`** and **`KV_REST_API_TOKEN`**. Use the read/write token, not the read-only token. Never commit or expose these values to the browser.
3. Keep **System Environment Variables** enabled. The app allows only the exact hosts supplied by `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_BRANCH_URL`, with matching HTTPS origins. An arbitrary `*.vercel.app` hostname is not trusted.
4. Deploy the main branch. Share the production project URL, not a protected preview URL. Check it from a signed-out browser before distributing it.

The root `server.js` is the fail-closed Vercel entrypoint; `npm start` continues to use `server/index.js` locally. Local runs always use their existing JSON file. Cloud runs require valid Redis configuration and never substitute local files or in-memory state when the store is unavailable. `.env.example` documents variable names only; this dependency-free app does not automatically load `.env` files.

Cloud data uses `agendaya:production:state:v1`; previews use `agendaya:preview:state:v1`, so normal previews do not modify the production demo. An optional `AGENDA_REDIS_KEY` overrides the namespace. Preview deployments using the same preview key share their mock data. Do not point automated experiments or resets at the production key.

The Redis adapter keeps the same `read()` / `mutate(operation)` interface and the existing JSON schema. Reads use **`EVAL`**, not `EVAL_RO`, to reach the primary rather than a lagging replica. Missing state is initialized with `SET NX`. A mutation reads a fresh snapshot, applies the existing synchronous domain operation, and commits only if the serialized state still matches. A concurrent change causes a bounded retry (five attempts maximum); network failures, invalid state and quota failures are not blindly retried. Confirmation retries retain the existing hold-token idempotency. No authoritative state is cached inside a function.

This handles ordinary simultaneous demo requests without pretending the provider offers stronger partition/failover guarantees than it documents. The one-document design is intentionally small, not a production-scale database model. Data is shared across visitors and survives function restarts/redeployments while the connected database remains available. `npm run reset` affects **local JSON only**, never Redis. Back up cloud state before any deliberate reset through the provider dashboard.

Free-tier quotas still apply. The browser polls visible booking views every five seconds, so close unused tabs. At the current published limits, Upstash Free includes 500,000 monthly commands; quota exhaustion can make the demo unavailable. This setup does not enable paid upgrades or eviction.

Official references: [native Node servers on Vercel](https://vercel.com/docs/functions/runtimes/node-js), [Upstash primary reads with EVAL](https://upstash.com/blog/replicated-cache-backed-by-redis), [Upstash consistency limits](https://upstash.com/docs/redis/features/consistency), [Upstash Free pricing](https://upstash.com/pricing/redis).

## Try the four flows

1. **Configure working hours — US_001.** Open **Disponibilidad**, enable a weekday and edit up to three non-overlapping ranges. End must be after start. Save: a green toast appears for exactly 3,000 ms. Invalid ranges are highlighted and are not persisted.
2. **Block one date — US_003.** Choose a date and the required **Feriado** or **Motivo Personal** reason. A successful block disappears from public availability. A date with confirmed bookings cannot be blocked: an accessible dialog explains the conflict and its count.
3. **Select date and time — US_008.** Open **Reservar turno**. Choose an available date in the monthly calendar, then a time. The server creates a unique **15-minute HOLD**. The form shows its countdown; expiry releases the slot and displays a message. **Cambiar horario** releases the hold early.
4. **Enter guest details and confirm — US_009.** Name and HTML5-valid email are required; phone and note are optional. A valid submission atomically confirms the held slot and shows a persistent receipt/reference. Email and administrator notification are explicitly **simulated**; nothing is sent externally.

To observe the blocked-day conflict, first confirm a booking, then try blocking that same date. Cancellation and rescheduling are intentionally not offered.

## Scope and fixture assumptions

**Implemented:** weekly working-day/range editor; single-date blocking; public availability and 15-minute holds; guest validation and confirmation. Public availability updates every five seconds and is revalidated atomically when selecting or confirming. Every interactive UI control has a stable `data-cy` hook.

**Static supporting fixtures:** Lucía Méndez, one 30-minute advisory session, virtual format, Buenos Aires timezone, Monday–Friday `09:00–13:00` and `15:00–18:00` initially. These are demonstration data, not additional requirements. Slots advance by the fixture event duration; short valid working ranges are accepted even if they contain no full event. Touch controls and layouts are designed for desktop and narrow mobile views.

**Not implemented:** registration/login, authorization, profile or event CRUD, booking lists or personal-data URLs, cancellations, rescheduling, bulk date-range blocks, reassignment/exception automation, daily caps, buffers, lead-time settings, real mail/payment integrations or an automated test suite. Changing working hours **never deletes or cancels existing bookings**. It may invalidate an unfinished hold; confirmation always checks current availability again.

## Small architecture

```text
public/
  index.html, styles.css, favicon.svg   Accessible responsive interface
  js/app.js                            Startup and two-view navigation
  js/booking.js, js/admin.js            UI behavior, separate from domain rules
  js/api.js, js/ui.js                   HTTP transport and feedback helpers
  shared/dates.js, validation.js        Pure, reusable date/validation functions
server/
  index.js, config.js                   Local/cloud startup and trusted host configuration
  app.js                               Native HTTP routing and static-file allowlist
  domain.js                            Availability, holds, booking and blocking rules
  store.js                             Serialized mutations and atomic JSON replacement
  redis-store.js                       Primary reads and conditional cloud-state commits
  seed.js                              Explicit demonstration fixtures
server.js, vercel.json                  Native Node deployment entrypoint and settings
scripts/reset-data.js                   Explicit, offline fixture reset
docs/traceability.md                    Story-to-implementation/source mapping
```

The browser and server share validation helpers. The server remains authoritative: another browser can take a slot before a stale calendar refreshes. Locally, mutations execute one at a time against cloned state; a successful write replaces the JSON file before the in-memory state is committed. Cloud mutations use the conditional Redis commits described above. A failed validation does not commit a candidate. If a network failure makes a cloud write's outcome uncertain, the app reports failure rather than claiming it saved; retrying a confirmation with its existing hold token safely recovers its receipt. Holds use unpredictable 256-bit tokens.

Holds are logically expired when `now >= expiresAt`, even after a server restart. Expired records may remain in the JSON file until a later hold creation; they never block availability. The UI keeps only its hold capability in tab-scoped `sessionStorage`, not guest details. Reloading the same tab can restore a pending hold or its confirmed receipt.

The date helpers explicitly use Buenos Aires calendar dates. Slot timestamps use the fixture's current UTC−03:00 offset; this is not a general historical/DST timezone engine. `createApplication({ store, clock })` accepts an injected clock, and domain functions accept `now` explicitly, so expiry checks will not require waiting 15 minutes in future unit tests.

## HTTP contracts

JSON requests use `Content-Type: application/json`; responses use JSON unless requesting a static asset. All JSON responses are `no-store`.

| Method and endpoint | Request / response |
|---|---|
| `GET /api/config` | Mock profile/event, authoritative `serverNow`, local `today` |
| `GET /api/availability?month=YYYY-MM` | `{ month, days: [{date, slots}], serverNow, today }`; **no guest information or hold tokens** |
| `GET /api/admin/availability` | `{ weeklyHours, blockedDays }`; simulated administration |
| `PUT /api/admin/availability` | `{ weeklyHours: { monday: {enabled, ranges:[{start,end}]}, ... } }` for all seven English weekday keys |
| `POST /api/admin/blocked-days` | `{ date: "YYYY-MM-DD", reason: "Feriado" or "Motivo Personal" }`; returns blocked date |
| `POST /api/holds` | `{ eventId: "advisory-session", date, time: "HH:mm" }`; returns token, expiry, date/time and server time |
| `GET /api/holds/:token` | Active hold, or a non-personal receipt after confirmation; capability required |
| `DELETE /api/holds/:token` | Releases only that pending hold; never cancels a confirmed booking |
| `POST /api/bookings` | `{ holdToken, guest: {name,email,phone?,note?} }`; returns non-personal confirmed receipt with simulated-notification flags |

Errors use `{ message, code, fields? }`; booking-conflict errors also include `count`. Expected status codes: `400` invalid input, `409` unavailable/conflicting slot or date, `410` expired hold, `413` JSON body over 32 KiB, `415` unsupported content type. Unknown resources are `404`. Only explicitly allowlisted frontend files are served; the JSON storage is never served as a static file.

## Verification and next testing phase

This phase is **not test-driven**: the user's latest request expressly postponed creating tests until the foundation exists. JavaScript syntax and local runtime behavior can be checked now, but these checks are not a substitute for the later submitted test suite. No test coverage or automated PASS is claimed.

Future work: Cypress E2E in `cypress/e2e/`, and unit cases against shared validation/date helpers and the server domain. TP6 requires at least **one E2E plus five unit tests per member**, spanning at least two unit-level behaviors per person. With the eight members listed on the TP2 cover, that is **8 E2E + 40 unit = 48 tests**, subject to the current roster. Document prompts, AI output, edits, critical review and execution evidence when that phase is requested.

The assignment's minimum three descriptive commits and execution/report evidence remain requirements for the team's delivery; no history or individual authorship should be fabricated.

## Academic-demo limitations

- No authentication or authorization: the administrative screen is explicitly simulated. Share only as an academic sandbox; everyone with the link can change shared availability. Never use real personal information.
- Local development binds to HTTP loopback. Vercel supplies HTTPS. Exact host/origin checks and a same-origin content security policy reduce accidental exposure, but do not make this a hardened multi-user service.
- Local JSON storage is designed for **one process**. Cloud Redis uses one shared state document and bounded contention retries, not production durability/service-level guarantees. Keep a backup before resets.
- No real mail or video-call room is created. The receipt confirms only a persisted demonstration booking. Cloud state is stored with the connected Upstash provider.
- Cross-browser, performance and automated acceptance evidence are still pending. Source conflicts and intentionally excluded behaviors are documented in [traceability](docs/traceability.md).
