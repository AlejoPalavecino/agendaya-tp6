# AgendaYA · TP6

A small, working availability-and-booking prototype for **Ingeniería y Calidad de Software, Grupo 01**. It implements the four mandatory TP6 flows from modules **M02 and M04**, with a responsive Spanish interface and a local Node.js mini backend.

> [!IMPORTANT]
> This is a **local academic demo**, not a production service. The professional, service and notifications are simulated. Use fictitious guest data. Automated test authoring was explicitly deferred; no Cypress installation or test suite is included yet.

## Run locally

Requires **Node.js 24 or newer** with npm. No dependencies, installation or build step are needed.

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

## Try the four flows

1. **Configure working hours — US_001.** Open **Disponibilidad**, enable a weekday and edit up to three non-overlapping ranges. End must be after start. Save: a green toast appears for exactly 3,000 ms. Invalid ranges are highlighted and are not persisted.
2. **Block one date — US_003.** Choose a date and the required **Feriado** or **Motivo Personal** reason. A successful block disappears from public availability. A date with confirmed bookings cannot be blocked: an accessible dialog explains the conflict and its count.
3. **Select date and time — US_008.** Open **Reservar turno**. Choose an available date in the monthly calendar, then a time. The server creates a unique **15-minute HOLD**. The form shows its countdown; expiry releases the slot and displays a message. **Cambiar horario** releases the hold early.
4. **Enter guest details and confirm — US_009.** Name and HTML5-valid email are required; phone and note are optional. A valid submission atomically confirms the held slot and shows a persistent receipt/reference. Email and administrator notification are explicitly **simulated**; nothing is sent externally.

To observe the blocked-day conflict, first confirm a booking, then try blocking that same date. Cancellation and rescheduling are intentionally not offered.

## Scope and fixture assumptions

**Implemented:** weekly working-day/range editor; single-date blocking; public availability and 15-minute holds; guest validation and confirmation. Public availability updates every five seconds and is revalidated atomically when selecting or confirming. Every interactive UI control has a stable `data-cy` hook.

**Static supporting fixtures:** Lucía Méndez, one 30-minute advisory session, virtual format, Buenos Aires timezone, Monday–Friday `09:00–13:00` and `15:00–18:00` initially. These are demonstration data, not additional requirements. Slots advance by the fixture event duration; short valid working ranges are accepted even if they contain no full event. Touch controls and layouts are designed for desktop and narrow mobile views.

**Not implemented:** registration/login, authorization, profile or event CRUD, booking lists or personal-data URLs, cancellations, rescheduling, bulk date-range blocks, reassignment/exception automation, daily caps, buffers, lead-time settings, real mail/payment integrations, deployment or an automated test suite. Changing working hours **never deletes or cancels existing bookings**. It may invalidate an unfinished hold; confirmation always checks current availability again.

## Small architecture

```text
public/
  index.html, styles.css, favicon.svg   Accessible responsive interface
  js/app.js                            Startup and two-view navigation
  js/booking.js, js/admin.js            UI behavior, separate from domain rules
  js/api.js, js/ui.js                   HTTP transport and feedback helpers
  shared/dates.js, validation.js        Pure, reusable date/validation functions
server/
  index.js                             Local startup and configuration
  app.js                               Native HTTP routing and static-file allowlist
  domain.js                            Availability, holds, booking and blocking rules
  store.js                             Serialized mutations and atomic JSON replacement
  seed.js                              Explicit demonstration fixtures
scripts/reset-data.js                   Explicit, offline fixture reset
docs/traceability.md                    Story-to-implementation/source mapping
```

The browser and server share validation helpers. The server remains authoritative: another browser can take a slot before a stale calendar refreshes. Mutations execute one at a time against cloned state; a successful write replaces the JSON file before the in-memory state is committed. A failed validation or write does not commit a candidate. Holds use unpredictable 256-bit tokens; confirmation retries with the same token return the existing receipt instead of creating duplicates.

Holds are logically expired when `now >= expiresAt`, even after a server restart. Expired records may remain in the JSON file until a later hold creation; they never block availability. The UI keeps only its hold capability in tab-scoped `sessionStorage`, not guest details. Reloading the same tab can restore a pending hold or its confirmed receipt.

The date helpers explicitly use Buenos Aires calendar dates. Slot timestamps use the fixture's current UTC−03:00 offset; this is not a general historical/DST timezone engine. `createApplication({ store, clock })` accepts an injected clock, and domain functions accept `now` explicitly, so expiry checks will not require waiting 15 minutes in future unit tests.

## HTTP contracts

JSON requests use `Content-Type: application/json`; responses use JSON unless requesting a static asset. All JSON responses are `no-store`.

| Method and endpoint | Request / response |
|---|---|
| `GET /api/config` | Mock profile/event, authoritative `serverNow`, local `today` |
| `GET /api/availability?month=YYYY-MM` | `{ month, days: [{date, slots}], serverNow, today }`; **no guest information or hold tokens** |
| `GET /api/admin/availability` | `{ weeklyHours, blockedDays }`; local simulated administration |
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

Git setup, commits and a remote repository have not been created automatically. The assignment's minimum three descriptive commits and execution/report evidence remain delivery work for the team; no history or individual authorship is fabricated.

## Local-demo limitations

- No authentication or authorization: the administrative screen is explicitly simulated. Never expose this server to the internet or use real personal information.
- HTTP loopback development only, not production HTTPS. Host/origin checks and a same-origin content security policy reduce accidental exposure, but do not make this a hardened multi-user service.
- JSON storage is designed for **one process**, not distributed writers or production durability guarantees. Keep a backup before resets.
- No real mail, video-call room or external side effects are created. The receipt confirms only a locally persisted demonstration booking.
- Cross-browser, performance and automated acceptance evidence are still pending. Source conflicts and intentionally excluded behaviors are documented in [traceability](docs/traceability.md).
