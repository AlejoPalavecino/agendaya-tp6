# TP6 scope and traceability

## Controlling sources

The TP6 assignment is **Tarea A**, pp. 3–5 of `Práctica/TP6/TP Nº6 - Testing Automatizado.pdf` in the course material. It mandates M02 **working hours / block one day**, and M04 **select date/time / form and confirmation**. It permits a mock backend or browser storage, requires stable `data-cy` selectors, visible empty-field validation and visible completion, and discourages adding unrelated functionality.

Course folder: `C:\Users\alejo\Documents\Facu\2026\Ingenieria y calidad de software`.

- `Práctica/TP2/Trabajo Práctico Nº2 - Historias de Usuario - Grupo 01.pdf`: cover identifies modules 02/04 and eight members; pp. 3–5 map US_001–US_010; pp. 6–7 detail US_001.
- `Práctica/TP1/Informe Trabajo Práctico 1 - Usabilidad y calidad de requisitos en el desarrollo de un sistema (Grupo 1).pdf`: pp. 4–5 working hours/day blocks; pp. 8–10 booking; pp. 14–15 mobile usability.
- `Trabajos Prácticos/Requerimientos Corregidos - AgendaYA.pdf`: refined RF/RNF wording, with numbering differences from Trello and final TP1.
- `Trabajos Prácticos/JSON-TABLERO-TELLO.json`: local Trello snapshot with `dateLastActivity: 2026-05-11T20:51:57.063Z`; **not a claim of current live-board state**.
- [Live Grupo 01 board](https://trello.com/b/dCA6zjdG): the four included story descriptions were checked during scope discovery. No board content was modified.

## Implementation map

| Story and source | Behavior / UI selectors | Pure rules and API |
|---|---|---|
| [US_001: working hours](https://trello.com/c/0ITNJdLY) | Enable days; max 3 independent ranges; end strictly after start; reject invalid save and highlight fields; green/red upper-right 3,000 ms toast. `working-day-toggle`, `add-range`, `remove-range`, `range-start`, `range-end`, `range-error`, `save-schedule`, `feedback-toast`. Combine repeated selectors with `data-day` and `data-index`. | `validateSchedule`, `normalizeSchedule`, `updateSchedule`, `scheduledSlots`. `PUT /api/admin/availability`. Prior confirmed bookings are preserved. Overlap rejection is interval integrity, not an extra workflow. |
| [US_003: block one day](https://trello.com/c/WpUzFEqE) | Required single date and fixed dropdown `Feriado` / `Motivo Personal`. Block free date; green success toast. Existing confirmed bookings reject saving and open count-aware dialog. `block-date`, `block-reason`, `block-day`, `blocked-day`, `conflict-modal`, `close-conflict-modal`, `acknowledge-conflict`. | `validateBlock`, `blockDay`, `availableSlots`. `POST /api/admin/blocked-days`. No force block, cancellation or rescheduling controls. |
| [US_008: date and time](https://trello.com/c/ZoWiNxB4) | Monthly calendar and available-time buttons; unique HOLD, exact 15-minute expiry, visible countdown and expiry notice. `calendar-month`, `previous-month`, `next-month`, `calendar-day` + `data-date`, `time-slot` + `data-time`, `hold-timer`, `change-time`, `booking-expired`. | `datesInMonth`, `scheduledSlots`, `availableSlots`, `createHold`, `isLiveHold`, `findHold`. `GET /api/availability`, `POST /api/holds`, `GET/DELETE /api/holds/:token`. Selection and confirmation revalidate server state; overlapping bookings cannot be created even after schedule changes. |
| [US_009: guest and confirmation](https://trello.com/c/NVecgW3v) | Name/email required; HTML5 email; optional phone/note; inline errors plus toast; visible persistent success receipt. `guest-form`, `guest-name`, `guest-email`, `guest-phone`, `guest-note`, corresponding `*-error`, `confirm-booking`, `booking-confirmation`, `booking-reference`, `simulated-notifications`, `new-booking`. | `validateGuest`, `isValidEmail`, `confirmBooking`, `bookingReceipt`. `POST /api/bookings`. Requires live owned hold; same-token retry is idempotent; no public response includes guest data. |

Common navigation: `nav-booking`, `nav-availability`, `brand-home`, `skip-content`. Error containers carry `data-cy`; status/error messages use live regions or alerts. Modals use native `dialog` with labeled controls and keyboard dismissal. No generated selector depends on presentation CSS.

### RF aliases: do not silently renumber the sources

- **US_001:** M02-F01 + M02-NF02 across the relevant sources.
- **US_003:** TP1/corrected PDF M02-F03 + M02-NF02; the local Trello RF card calls day blocking **M02-F02**, duplicating the identifier used for schedule exceptions. Story identity and behavior are the stable references.
- **US_008:** M04-F01 + M04-F02 in TP2/Trello; M04-F02 owns the 15-minute HOLD.
- **US_009:** TP2 maps M04-F03/M04-F04. Submitted TP1 splits input F03, email validation F04 and transaction F05; Trello combines input/validation in F03 and confirmation/notification in F04. Confirmation remains required by TP6 regardless of identifier drift.
- **Notifications:** submitted TP1 uses F06 for administrator notice and F07 for SMTP failure; the standalone corrected PDF uses F06 for guest email, F07 for administrator notifications and F08 for SMTP failure. This prototype only simulates success notices, explicitly labeled as such; it does not claim a real SMTP implementation or SMTP-error flow.

## Boundaries and known ambiguities

1. **US_006 — not implemented.** The local snapshot contradicts itself: conversation says not to apply an occupied-range edit, but acceptance adds reassignment, email and a 24-hour cancellation deadline. The live board now uses the label `Excepcion` instead of snapshot `A reasignar`, while retaining a contradictory notification/deadline policy. TP1 describes preserving an active booking marked `Excepción`. Do not infer cancellation authority from these conflicting statements. This foundation simply preserves confirmed bookings when working hours change; it does not implement exception labels or reassignment automation.
2. **US_004 — not implemented.** Bulk-range blocking is not a required TP6 flow. Its `Vacaciones` / `Licencia Médica` categories differ from the TP1 combined blocker category list. Single-date US_003 explicitly supplies `Feriado` / `Motivo Personal`; those are the only two reasons offered here.
3. **US_002/005/007 — not implemented.** Daily maximum, interval buffer and configurable lead time are existing backlog stories, but not necessary for the requested minimum. They are not silently added as settings or constraints. There is no hidden lead-time minimum beyond preventing past slots.
4. **US_010 — supporting fixture only.** A static professional and service give the booking flow real context. No profile or event management is introduced.
5. The 30-minute event, default week and Buenos Aires clock are fixtures. End-after-start is accepted without an invented minimum range duration; if no complete event fits, no slot is generated.
6. Requirement documents mention production database persistence, email, privacy/HTTPS and cross-browser/performance goals. The assignment expressly permits mock infrastructure. JSON storage, local simulated notices, no personal-data listing and loopback binding provide this prototype's bounded behavior; they are not evidence of production compliance.

## Deferred evidence

- The user explicitly asked to build the foundation before creating tests. No automated tests or Cypress dependency were authored in this phase, despite a generic pre-existing TDD preference.
- Future Cypress scenarios should use the selectors above; future unit checks should call pure rules with explicit state/time values. `createApplication({store, clock})` and alternate `AGENDA_DATA_FILE` support isolation. No clock-control or reset endpoint is exposed to browsers.
- TP6 pp. 2, 5 and 7 require at least 1 E2E and 5 unit tests per member, with unit coverage of at least two different behaviors. Eight unchanged members would require **48 total**, including **40 unit** tests. Confirm the current roster when assigning individual work.
- Git history (at least three descriptive commits), repository link, manual/automated execution captures, AI prompt/output/edit/critique records, presentation and written reflection remain team deliverables. No commits, individual authorship, browser coverage or passing tests are fabricated.
