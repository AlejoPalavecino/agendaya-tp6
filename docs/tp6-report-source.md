# AgendaYA — Trabajo Práctico N.º 6: Testing Automatizado

> Fuente de trabajo para el documento de Google del Grupo 01. Conserva el orden obligatorio de la sección 10.2 del enunciado. Los rótulos de integrantes son una **distribución propuesta para revisión y defensa**, no una declaración de autoría individual. Los enlaces locales al código deberán sustituirse por enlaces de GitHub después de publicar esta rama.

## 1. Carátula

**AGENDA YA**

**Ingeniería y Calidad de Software — Grupo 01 — Módulos 02 y 04**
**Trabajo Práctico N.º 6: Testing Automatizado**

**Integrantes (según informes TP1 y TP5):** Valentin Mendez, Facundo Rodriguez, Alvaro Tapia, Luciano Romero, Augusto Berloin, Martin Flores, Valentin Fornes y Alejo Palavecino.

**Fecha de este borrador:** 27/09/2026. **Fecha de entrega y validación del equipo:** pendiente.

## 2. Enlace al repositorio Git

**Repositorio configurado en Git:** [agendaya-tp6](https://github.com/AlejoPalavecino/agendaya-tp6). **Estado de publicación:** la rama de trabajo `codex/tp6-coverage-tests` todavía es local; no se afirma que los cambios y pruebas nuevos estén disponibles en GitHub. El historial local contiene más de los tres commits descriptivos pedidos; entre los trabajos relevantes están `8b50e11` (configuraciones rápidas), `1ead3a0` (rangos y excepciones), `9ac2682` (catálogo y avisos simulados), `03e8878` (40 casos unitarios) y `7f1aac6` (ocho recorridos Cypress). Antes de entregar, el equipo deberá publicar la rama o integrar las partes independientes a `main`, sustituir los enlaces locales al código por enlaces al commit publicado y confirmar el historial remoto.

## 3. Tarea A — Frontend mínimo de AgendaYA

Se implementó una demo navegable con interfaz responsiva en HTML, CSS y JavaScript y un minibackend Node. El módulo M02 permite configurar horarios, límites y bloqueos; M04 permite elegir una prestación, fecha y hora, mantener el horario por 15 minutos e ingresar los datos del invitado para confirmar. El almacenamiento local es JSON y la configuración de nube usa Redis; el enunciado permite un backend simulado. Los controles usados por Cypress tienen atributos `data-cy` estables.

| Flujo obligatorio del TP6 | Estado observable y criterio de aceptación |
|---|---|
| M02: configurar horario laboral | Se pueden habilitar días y guardar hasta tres franjas; el fin debe ser posterior al inicio. Una entrada inválida muestra error y no se guarda; la válida presenta confirmación visible. |
| M02: bloquear un día | Se solicita fecha y categoría. El bloqueo exitoso desaparece del calendario público; una reserva existente produce un diálogo de conflicto. |
| M04: seleccionar fecha y hora | El calendario muestra horarios libres del servicio seleccionado. La selección crea un HOLD exclusivo de 15 minutos con contador; la caducidad o el cambio de horario lo libera. |
| M04: completar formulario y confirmar | Nombre y correo son obligatorios; teléfono y nota, opcionales. Los errores se ven en el formulario. La confirmación mantiene una referencia y un comprobante sin datos privados. |

El alcance solicitado además compara **US_001–US_010** del grupo. Se incorporaron cupo diario, intervalos, antelación, bloqueo de rangos, excepciones con plazo de 24 horas y elección entre dos servicios estáticos. La [matriz de trazabilidad](traceability.md) separa evidencia E2E, unitaria e integración por historia y conserva los identificadores RF propios de cada fuente. Cuando TP1 contradice los criterios de aceptación de Trello/TP2, se siguieron estos últimos por decisión del usuario. En particular, US_006 conserva la reserva afectada como excepción para su reasignación; US_004 utiliza `Vacaciones`/`Licencia Médica` para rangos y US_003 mantiene sus categorías de día individual.

**Límites:** Lucía Méndez y los dos servicios virtuales de 30 minutos son datos de demostración, no exigencias del negocio. El panel de administración no autentica usuarios; nunca debe usarse información personal real. Los avisos al invitado y al administrador solo se registran como `SIMULATED_NOT_SENT` o `SIMULATED_FAILED`: **no se envía correo**. La reasignación del invitado depende de conservar la misma sesión del navegador, y las excepciones vencidas se actualizan al recibir la siguiente solicitud, no mediante un proceso de fondo. No se afirma cumplimiento de producción, SMTP, rendimiento ni compatibilidad entre navegadores.

## 4. Tarea B — Tests E2E con Cypress

Cada caso restablece una copia en memoria del estado inicial y un reloj controlado; el servidor se levanta solo en un puerto local libre desde `cypress.config.js`. Los ocho recorridos usan comentarios `Arrange`, `Act` y `Assert` y variantes diferentes de los flujos M02/M04. La numeración siguiente corresponde al orden de casos dentro del archivo, **no a ocho autorías comprobadas**.

| Bloque propuesto para revisión | Variante integral | Resultado final |
|---|---|---|
| 1 — Valentin Mendez | Guardar y recargar tres franjas de un día | Aprobado |
| 2 — Facundo Rodriguez | Rechazar horas/intervalos inválidos y aplicar antelación | Aprobado |
| 3 — Alvaro Tapia | Bloquear un día y verificar calendario público | Aprobado |
| 4 — Luciano Romero | Rechazar rango invertido y bloquear ambos extremos | Aprobado |
| 5 — Augusto Berloin | Elegir servicio, crear HOLD y liberarlo | Aprobado |
| 6 — Martin Flores | Rechazar HOLD duplicado y liberar al vencer | Aprobado |
| 7 — Valentin Fornes | Validar datos del invitado y confirmar con aviso simulado | Aprobado |
| 8 — Alejo Palavecino | Advertir conflicto, crear excepción y reasignar | Aprobado |

**Código íntegro del archivo E2E, incluidos helpers y los ocho casos:** [`cypress/e2e/tp6.cy.js`](../cypress/e2e/tp6.cy.js). El código de cada test se reproduce a continuación para que el informe sea autocontenido.

```javascript
// The eight blocks are proposed assignments for student review, not claims of authorship.
const FIXED_NOW = Date.parse('2026-09-28T08:00:00-03:00');
const TUESDAY = '2026-09-29';

function openAdmin() {
  cy.get('[data-cy="nav-availability"]').click();
  cy.get('[data-cy="schedule-form"]').should('be.visible');
}

function selectSlot(date = TUESDAY, time = '09:00') {
  cy.get(`[data-cy="calendar-day"][data-date="${date}"]`).click();
  cy.get(`[data-cy="time-slot"][data-time="${time}"]`).click();
  cy.get('[data-cy="guest-form"]').should('be.visible');
}

function confirmFixtureBooking() {
  selectSlot();
  cy.get('[data-cy="guest-name"]').type('Persona de Prueba');
  cy.get('[data-cy="guest-email"]').type('persona@example.test');
  cy.get('[data-cy="confirm-booking"]').click();
  cy.get('[data-cy="booking-confirmation"]').should('be.visible');
}

describe('TP6 AgendaYA browser journeys', () => {
  beforeEach(() => {
    cy.task('resetDemo', { now: FIXED_NOW });
    cy.clearAllSessionStorage();
    cy.visit('/');
    cy.get('[data-cy="calendar-month"]').should('be.visible');
  });

  it('proposed member 1: saves three independent working ranges', () => {
    // Arrange: Saturday starts disabled in the academic fixture.
    openAdmin();
    cy.get('[data-cy="working-day-toggle"][data-day="saturday"]').should('not.be.checked');

    // Act: enable the day, add the maximum three ranges, and persist the schedule.
    cy.get('[data-cy="working-day-toggle"][data-day="saturday"]').check();
    cy.get('[data-cy="add-range"][data-day="saturday"]').click();
    cy.get('[data-cy="add-range"][data-day="saturday"]').click();
    cy.get('[data-cy="save-schedule"]').click();

    // Assert: the success feedback and all three ranges survive a page reload.
    cy.get('[data-cy="feedback-toast"]').should('be.visible').and('contain.text', 'guardados');
    cy.get('[data-cy="add-range"][data-day="saturday"]').should('be.disabled');
    cy.reload();
    cy.get('[data-cy="working-day-toggle"][data-day="saturday"]').should('be.checked');
    cy.get('[data-cy="range-start"][data-day="saturday"]').should('have.length', 3);
  });

  it('proposed member 2: rejects invalid hours and applies booking quick settings', () => {
    // Arrange: Monday has public slots with the default one-hour lead.
    cy.get('[data-cy="calendar-day"][data-date="2026-09-28"]').should('not.be.disabled');
    openAdmin();

    // Act: try an inverted range and an out-of-bounds interval before saving valid settings.
    cy.get('[data-cy="range-start"][data-day="monday"][data-index="0"]').clear().type('11:00');
    cy.get('[data-cy="range-end"][data-day="monday"][data-index="0"]').clear().type('10:00');
    cy.get('[data-cy="save-schedule"]').click();
    cy.get('[data-cy="interval-minutes"]').clear().type('121');
    cy.get('[data-cy="save-quick-settings"]').click();
    cy.get('[data-cy="max-daily-bookings"]').clear().type('1');
    cy.get('[data-cy="interval-minutes"]').clear().type('15');
    cy.get('[data-cy="lead-hours"]').clear().type('24');
    cy.get('[data-cy="save-quick-settings"]').click();

    // Assert: invalid inputs were rejected, and lead time changes the public calendar.
    cy.get('[data-cy="range-error"]').first().should('contain.text', 'posterior');
    cy.get('[data-cy="interval-minutes"]').should('have.value', '15');
    cy.get('[data-cy="feedback-toast"]').should('be.visible').and('contain.text', 'guardada');
    cy.get('[data-cy="nav-booking"]').click();
    cy.get('[data-cy="calendar-day"][data-date="2026-09-28"]').should('be.disabled');
    cy.get(`[data-cy="calendar-day"][data-date="${TUESDAY}"]`).should('not.be.disabled');
  });

  it('proposed member 3: blocks one day and removes it from public availability', () => {
    // Arrange: September 30 has available hours before the block.
    cy.get('[data-cy="calendar-day"][data-date="2026-09-30"]').should('not.be.disabled');
    openAdmin();

    // Act: block the complete date for a permitted single-day reason.
    cy.get('[data-cy="block-date"]').type('2026-09-30');
    cy.get('[data-cy="block-reason"]').select('Feriado');
    cy.get('[data-cy="block-day"]').click();

    // Assert: the admin list and the public calendar agree.
    cy.get('[data-cy="blocked-day"][data-date="2026-09-30"]').should('contain.text', 'Feriado');
    cy.get('[data-cy="nav-booking"]').click();
    cy.get('[data-cy="calendar-day"][data-date="2026-09-30"]').should('be.disabled');
  });

  it('proposed member 4: validates and applies an inclusive date-range block', () => {
    // Arrange: move from the September fixture month to the October range.
    openAdmin();

    // Act: reject reversed dates, then block October 1 through 2 as vacation.
    cy.get('[data-cy="block-range-form"] [data-cy="range-start"]').type('2026-10-02');
    cy.get('[data-cy="block-range-form"] [data-cy="range-end"]').type('2026-10-01');
    cy.get('[data-cy="block-range-form"] [data-cy="range-reason"]').select('Vacaciones');
    cy.get('[data-cy="block-range"]').should('be.disabled');
    cy.get('[data-cy="range-end-error"]').should('contain.text', 'posterior');
    cy.get('[data-cy="block-range-form"] [data-cy="range-start"]').clear().type('2026-10-01');
    cy.get('[data-cy="block-range-form"] [data-cy="range-end"]').clear().type('2026-10-02').blur();
    cy.intercept('POST', '**/api/admin/blocked-ranges').as('blockRange');
    cy.get('[data-cy="block-range"]').click();
    cy.get('[data-cy="range-start-error"]').should('be.empty');
    cy.get('[data-cy="range-end-error"]').should('be.empty');
    cy.get('[data-cy="range-reason-error"]').should('be.empty');
    cy.get('[data-cy="range-submit-error"]').should('be.empty');
    cy.wait('@blockRange').its('response.statusCode').should('eq', 201);

    // Assert: both inclusive endpoints are unavailable and the range is listed.
    cy.get('[data-cy="blocked-range"]').should('contain.text', 'Vacaciones');
    cy.get('[data-cy="nav-booking"]').click();
    cy.get('[data-cy="next-month"]').click();
    cy.get('[data-cy="calendar-day"][data-date="2026-10-01"]').should('be.disabled');
    cy.get('[data-cy="calendar-day"][data-date="2026-10-02"]').should('be.disabled');
  });

  it('proposed member 5: selects a service, obtains a hold, and releases it', () => {
    // Arrange: both static service types are visible on the public page.
    cy.get('[data-cy="event-type"]').should('have.length', 2);

    // Act: select the follow-up service and reserve a Tuesday time temporarily.
    cy.get('[data-cy="event-type"][data-event-id="follow-up-session"]').click();
    selectSlot();

    // Assert: the service and countdown are visible; changing time releases the slot.
    cy.get('[data-cy="booking-summary"]').should('contain.text', 'Consulta de seguimiento');
    cy.get('[data-cy="hold-timer"]').invoke('text').should('match', /1[45]:[0-5][0-9]/);
    cy.get('[data-cy="change-time"]').click();
    cy.get(`[data-cy="calendar-day"][data-date="${TUESDAY}"]`).click();
    cy.get('[data-cy="time-slot"][data-time="09:00"]').should('be.visible');
  });

  it('proposed member 6: prevents double holds and frees the slot after fifteen minutes', () => {
    // Arrange: this browser holds Tuesday 09:00.
    selectSlot();

    // Act: another HTTP client tries the same slot, then the server clock expires the hold.
    cy.request({
      method: 'POST', url: '/api/holds', failOnStatusCode: false,
      body: { eventId: 'advisory-session', date: TUESDAY, time: '09:00' },
    }).its('status').should('eq', 409);
    cy.task('advanceDemoClock', 15 * 60 * 1000 + 1);
    cy.reload();

    // Assert: expiry is visible and the previously held time can be selected again.
    cy.get('[data-cy="booking-expired"]').should('be.visible');
    cy.get(`[data-cy="calendar-day"][data-date="${TUESDAY}"]`).click();
    cy.get('[data-cy="time-slot"][data-time="09:00"]').should('be.visible');
  });

  it('proposed member 7: validates guest data and confirms with a simulated notice', () => {
    // Arrange: enter the required guest form through a real calendar selection.
    selectSlot();

    // Act: submit empty and malformed inputs, then complete a fictional guest booking.
    cy.get('[data-cy="confirm-booking"]').click();
    cy.get('[data-cy="guest-name-error"]').should('contain.text', 'Ingresa');
    cy.get('[data-cy="guest-email-error"]').should('contain.text', 'Ingresa');
    cy.get('[data-cy="guest-name"]').type('Persona de Prueba');
    cy.get('[data-cy="guest-email"]').type('invalid-email');
    cy.get('[data-cy="confirm-booking"]').click();
    cy.get('[data-cy="guest-email-error"]').should('contain.text', 'válido');
    cy.get('[data-cy="guest-email"]').clear().type('persona@example.test');
    cy.get('[data-cy="guest-phone"]').type('1112345678');
    cy.get('[data-cy="guest-note"]').type('Consulta de prueba');
    cy.get('[data-cy="confirm-booking"]').click();

    // Assert: the confirmation persists and its administrator alert is explicitly simulated.
    cy.get('[data-cy="booking-confirmation"]').should('be.visible');
    cy.get('[data-cy="booking-reference"]').invoke('text').then((reference) => {
      cy.get('[data-cy="simulated-notifications"]').should('contain.text', 'no se envió');
      cy.get('[data-cy="nav-availability"]').click();
      cy.get('[data-cy="booking-alert"]').should('contain.text', reference);
    });
  });

  it('proposed member 8: warns on booking conflict and reassigns a schedule exception', () => {
    // Arrange: confirm a fictional Tuesday 09:00 booking.
    confirmFixtureBooking();
    cy.get('[data-cy="booking-reference"]').invoke('text').as('reference');
    openAdmin();

    // Act: attempt an unsafe day block, then move Tuesday's first range past the booking.
    cy.get('[data-cy="block-date"]').type(TUESDAY);
    cy.get('[data-cy="block-reason"]').select('Feriado');
    cy.get('[data-cy="block-day"]').click();
    cy.get('[data-cy="conflict-modal"]').should('be.visible').and('contain.text', '1 turno');
    cy.get('[data-cy="acknowledge-conflict"]').click();
    cy.get('[data-cy="range-start"][data-day="tuesday"][data-index="0"]').clear().type('10:00');
    cy.get('[data-cy="save-schedule"]').click();
    cy.get('[data-cy="schedule-exception"]').should('contain.text', 'Excepción');
    cy.get('[data-cy="nav-booking"]').click();
    cy.reload();
    cy.get('[data-cy="booking-exception"]').should('be.visible');
    cy.get('[data-cy="choose-reassignment"]').click();
    cy.get(`[data-cy="calendar-day"][data-date="${TUESDAY}"]`).click();
    cy.get('[data-cy="time-slot"][data-time="10:00"]').click();

    // Assert: reassignment preserves the original reference and restores confirmation.
    cy.get('[data-cy="booking-confirmation"]').should('be.visible');
    cy.get('@reference').then((reference) => {
      cy.get('[data-cy="booking-reference"]').should('have.text', reference);
    });
  });
});
```

**Ejecución y evidencia.** En Windows se instaló Cypress 16.1.0 con pnpm 11.19.0 usando `CYPRESS_CACHE_FOLDER`; la ejecución headless `pnpm run test:e2e` reportó **8 aprobados, 0 fallidos, 0 pendientes y 0 omitidos** en Electron 146. El [log de la repetición](../cypress/evidence/headless-rerun-pnpm11.txt) y el [video real de la corrida](https://drive.google.com/file/d/1UQLdUejiBTVfabyBeNXp_Iw9fELTwLAy/view?usp=drivesdk) son la evidencia. Cypress informó **0 capturas de pantalla** y un video. No se registraron fallas E2E en la corrida final, por lo que no hay mensaje de error final que transcribir; los casos de datos inválidos y conflicto aprobaron precisamente porque verificaron el rechazo esperado. La instalación de dependencias sí falló en un sandbox por la creación de una junction `bluebird`; repetir el mismo procedimiento fuera del sandbox permitió ejecutar los ocho casos. Ese fallo de entorno no se presenta como defecto funcional.

**Comando reproducible:** establecer `CYPRESS_CACHE_FOLDER` en un directorio temporal escribible; ejecutar `pnpm install --frozen-lockfile`, `pnpm exec cypress install` y luego `pnpm run test:e2e`. No apunta a la instancia compartida: Cypress utiliza su servidor, estado y reloj aislados. Para la presentación en clase falta ejecutar en vivo, como mínimo, un caso exitoso y uno de error o borde.

## 5. Tarea C — Tests unitarios con asistencia de IA

Se prepararon ocho bloques propuestos de cinco casos cada uno (40 tests nuevos). Cada archivo examina por lo menos dos funciones o comportamientos y combina entradas normales, de borde e inválidas. Las pruebas son `node:test` sobre reglas puras o estado inyectado, no sobre la interfaz. La suite completa de Node informó **74 aprobados, 0 fallidos**: 68 casos unitarios de dominio/helpers (incluidos los 40 nuevos) y 6 casos de integración HTTP, que **no** se contabilizan en las cuotas individuales. Evidencia: [log de Node](../cypress/evidence/node-rerun.txt).

### Prompt exacto compartido y alcance de la IA

Se utilizó **un único prompt compartido** para generar los ocho bloques; no existieron ocho prompts personales. Se transcribe literalmente desde [`docs/unit-test-ai-record.md`](unit-test-ai-record.md):

> Implementá T4 ahora como escritor delegado. Leé odd/tasks/tp6-coverage-and-automated-tests.md; Engram mirror falla unknown_session. Usá tu inventario de 40 casos NUEVOS (8 bloques de 5), exactos o ajustes si T3 cambió dominio, en `test/unit/` con 8 archivos/block IDs, sin atribuir falsamente autoría individual. Cada bloque ≥2 funciones/comportamientos y normal/límite/inválido. Importante: TP6 pide prompt exacto, salida generada, cambios y evaluación crítica por bloque; creá `docs/unit-test-ai-record.md` honesto con prompt usado (tu instrucción aquí puede citarse como contexto pero redactá exacto prompt de generación), archivos de salida/código o fragmentos trazables, modificaciones efectivas y evaluación, sin afirmar que los ocho estudiantes lo escribieron. TDD ON inferido docs/traceability.md, runner node --test; para T4 son pruebas nuevas sobre comportamiento ya existente: registrá un fallo RED real de test/fixture si surge, NO inventes ni alteres código productivo para forzarlo. Ejecutá 40 y suite completa. No edit ODD doc ni commit. Route delegated writer; ~400 líneas heurística, no cap, RDD global OFF. Devolvé conteos unit vs integration y matiz autoría. Repo nested TP6-PROYECTO-FRONTEND-MINIBACKEND.

La salida completa de la herramienta son los ocho archivos reproducidos en los apartados siguientes, apoyados en el [fixture común](../test/unit/fixtures.js). La IA produjo una base útil de pruebas de reglas y límites, pero no demuestra comprensión de cada integrante, autoría personal, calidad de interfaz ni envío de correo. Los nombres indican **revisión/defensa propuesta**. Cada estudiante debe revisar, correr y explicar su bloque antes de atribuirle responsabilidad en el informe final.

### Bloque 1 — Valentin Mendez (asignación propuesta)

**Funciones/comportamientos:** `validateSchedule`, `normalizeSchedule`, `updateSchedule`. Cubre ausencia de un día, día habilitado vacío, límite de tres franjas, normalización y preservación de otro día. **Adaptación/evaluación:** el bloque quedó enfocado en reglas de dominio; el guardado visual y su feedback requieren E2E 1/2. No hubo modificación de producción para hacer pasar estas pruebas.

**Output íntegro:** [`test/unit/01-schedule.test.js`](../test/unit/01-schedule.test.js).

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSchedule, validateSchedule } from '../../public/shared/validation.js';
import { updateSchedule } from '../../server/domain.js';
import { NOW, seed } from './fixtures.js';

// Proposed allocation only: these AI-assisted tests do not assert individual authorship.
test('schedule validation identifies a missing weekday configuration', () => {
  const schedule = seed().weeklyHours;
  delete schedule.tuesday;
  assert.ok(validateSchedule(schedule).tuesday);
});

test('enabled weekdays require at least one time range', () => {
  const schedule = seed().weeklyHours;
  schedule.monday.ranges = [];
  assert.ok(validateSchedule(schedule).monday);
});

test('a fourth valid range exceeds the weekday limit', () => {
  const schedule = seed().weeklyHours;
  schedule.monday.ranges = [
    { start: '08:00', end: '08:30' }, { start: '09:00', end: '09:30' },
    { start: '10:00', end: '10:30' }, { start: '11:00', end: '11:30' },
  ];
  assert.ok(validateSchedule(schedule).monday);
});

test('schedule normalization removes transient editor metadata', () => {
  const schedule = seed().weeklyHours;
  schedule.monday.editorId = 'temporary';
  schedule.monday.ranges[0].selected = true;
  const normalized = normalizeSchedule(schedule);
  assert.deepEqual(normalized.monday, {
    enabled: true,
    ranges: [{ start: '09:00', end: '13:00' }, { start: '15:00', end: '18:00' }],
  });
});

test('updating Monday leaves unrelated weekday hours intact', () => {
  const state = seed();
  const tuesday = structuredClone(state.weeklyHours.tuesday);
  const schedule = structuredClone(state.weeklyHours);
  schedule.monday.ranges = [{ start: '10:00', end: '12:00' }];
  updateSchedule(state, schedule, NOW);
  assert.deepEqual(state.weeklyHours.tuesday, tuesday);
  assert.deepEqual(state.weeklyHours.monday.ranges, [{ start: '10:00', end: '12:00' }]);
});
```

### Bloque 2 — Facundo Rodriguez (asignación propuesta)

**Funciones/comportamientos:** `isValidDate`, `isValidMonth`, `timeToMinutes`, `minutesToTime`, `datesInMonth`. Cubre año bisiesto, borde del año admitido, reloj inválido y expansión de mes. **Adaptación/evaluación:** prueba el cálculo de fechas, no la presentación del huso horario del navegador; esa limitación permanece.

**Output íntegro:** [`test/unit/02-datetime.test.js`](../test/unit/02-datetime.test.js).

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { datesInMonth, isValidDate, isValidMonth, minutesToTime, timeToMinutes } from '../../public/shared/dates.js';

// Proposed allocation only: these AI-assisted tests do not assert individual authorship.
test('calendar validation accepts February 29 in a leap year', () => {
  assert.equal(isValidDate('2028-02-29'), true);
});

test('calendar validation rejects February 29 in a common year', () => {
  assert.equal(isValidDate('2027-02-29'), false);
});

test('month validation enforces its upper supported year boundary', () => {
  assert.equal(isValidMonth('9998-12'), true);
  assert.equal(isValidMonth('9999-01'), false);
});

test('time conversion round-trips the final minute and rejects 24:00', () => {
  assert.equal(timeToMinutes('23:59'), 1439);
  assert.equal(minutesToTime(1439), '23:59');
  assert.equal(timeToMinutes('24:00'), null);
});

test('month expansion includes all 29 leap-February dates in order', () => {
  const dates = datesInMonth('2028-02');
  assert.equal(dates.length, 29);
  assert.equal(dates[0], '2028-02-01');
  assert.equal(dates.at(-1), '2028-02-29');
});
```

### Bloque 3 — Alvaro Tapia (asignación propuesta)

**Funciones/comportamientos:** `validateBlock`, `blockDay`. Cubre fecha/motivo inválidos, inserción ordenada, superposición con rango y la excepción de una reserva cancelada. **Adaptación/evaluación:** el diálogo visible por una reserva confirmada se verifica en E2E 8; el bloque solo prueba la regla.

**Output íntegro:** [`test/unit/03-day-blocking.test.js`](../test/unit/03-day-blocking.test.js).

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateBlock } from '../../public/shared/validation.js';
import { blockDay } from '../../server/domain.js';
import { booking, MONDAY, seed } from './fixtures.js';

// Proposed allocation only: these AI-assisted tests do not assert individual authorship.
test('single-day validation rejects an impossible calendar date', () => {
  assert.ok(validateBlock({ date: '2026-09-31', reason: 'Feriado' }).date);
});

test('single-day validation does not accept a range-only reason', () => {
  assert.ok(validateBlock({ date: MONDAY, reason: 'Vacaciones' }).reason);
});

test('blocking a free day keeps the day list chronological', () => {
  const state = seed();
  state.blockedDays.push({ date: '2026-10-02', reason: 'Feriado' });
  blockDay(state, { date: MONDAY, reason: 'Motivo Personal' });
  assert.deepEqual(state.blockedDays.map(({ date }) => date), [MONDAY, '2026-10-02']);
});

test('a day inside an existing blocked range cannot be blocked again', () => {
  const state = seed();
  state.blockedRanges.push({ startDate: MONDAY, endDate: '2026-09-30', reason: 'Vacaciones' });
  const original = structuredClone(state.blockedDays);
  assert.throws(() => blockDay(state, { date: '2026-09-29', reason: 'Feriado' }),
    (error) => error.status === 409 && error.code === 'ALREADY_BLOCKED');
  assert.deepEqual(state.blockedDays, original);
});

test('a cancelled booking does not prevent blocking its former day', () => {
  const state = seed();
  state.bookings.push(booking({ status: 'CANCELLED' }));
  assert.deepEqual(blockDay(state, { date: MONDAY, reason: 'Feriado' }), { date: MONDAY, reason: 'Feriado' });
});
```

### Bloque 4 — Luciano Romero (asignación propuesta)

**Funciones/comportamientos:** `validateDateRange`, `blockDateRange`. Cubre inicio/categoría inválidos, reserva cancelada, ordenación y rangos adyacentes. **Adaptación/evaluación:** la transacción con reserva activa y rollback tiene pruebas adicionales en `test/ranges-exceptions.test.js`; no se debe deducir solo de estos cinco casos.

**Output íntegro:** [`test/unit/04-range-blocking.test.js`](../test/unit/04-range-blocking.test.js).

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDateRange } from '../../public/shared/validation.js';
import { blockDateRange } from '../../server/domain.js';
import { booking, MONDAY, seed } from './fixtures.js';

// Proposed allocation only: these AI-assisted tests do not assert individual authorship.
test('range validation flags an impossible start date', () => {
  assert.ok(validateDateRange({ startDate: '2026-09-31', endDate: '2026-10-02', reason: 'Vacaciones' }).startDate);
});

test('range validation requires a category even for valid dates', () => {
  assert.ok(validateDateRange({ startDate: MONDAY, endDate: '2026-09-30' }).reason);
});

test('a cancelled reservation does not conflict with range blocking', () => {
  const state = seed();
  state.bookings.push(booking({ status: 'CANCELLED' }));
  assert.deepEqual(blockDateRange(state, { startDate: MONDAY, endDate: '2026-09-30', reason: 'Vacaciones' }),
    { startDate: MONDAY, endDate: '2026-09-30', reason: 'Vacaciones' });
});

test('separate range blocks are sorted by their start date', () => {
  const state = seed();
  blockDateRange(state, { startDate: '2026-10-05', endDate: '2026-10-07', reason: 'Vacaciones' });
  blockDateRange(state, { startDate: MONDAY, endDate: '2026-09-30', reason: 'Licencia Médica' });
  assert.deepEqual(state.blockedRanges.map(({ startDate }) => startDate), [MONDAY, '2026-10-05']);
});

test('adjacent ranges with no shared date are both allowed', () => {
  const state = seed();
  blockDateRange(state, { startDate: MONDAY, endDate: '2026-09-29', reason: 'Vacaciones' });
  blockDateRange(state, { startDate: '2026-09-30', endDate: '2026-10-01', reason: 'Licencia Médica' });
  assert.equal(state.blockedRanges.length, 2);
});
```

### Bloque 5 — Augusto Berloin (asignación propuesta)

**Funciones/comportamientos:** `updateSchedule`, `expireExceptions`, `exceptionSummary`. Cubre futuro/pasado, vencimiento selectivo e idempotente, y privacidad del resumen. **Adaptación/evaluación:** el aviso es simulado; estas aserciones no prueban correo enviado ni un planificador de fondo.

**Output íntegro:** [`test/unit/05-exceptions.test.js`](../test/unit/05-exceptions.test.js).

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exceptionSummary, expireExceptions, updateSchedule } from '../../server/domain.js';
import { booking, NOW, seed } from './fixtures.js';

function exceptionState() {
  const state = seed();
  state.bookings.push(booking());
  const schedule = structuredClone(state.weeklyHours);
  schedule.monday.enabled = false;
  schedule.monday.ranges = [];
  updateSchedule(state, schedule, NOW);
  return state;
}

// Proposed allocation only: these AI-assisted tests do not assert individual authorship.
test('disabling a working day flags its future booking as an exception', () => {
  const state = exceptionState();
  assert.equal(state.bookings[0].status, 'EXCEPTION');
  assert.equal(state.bookings[0].exceptionDeadline, NOW + 24 * 60 * 60 * 1000);
});

test('a past booking is not newly flagged when its weekday is disabled', () => {
  const state = seed();
  state.bookings.push(booking({ date: '2026-09-25' }));
  const schedule = structuredClone(state.weeklyHours);
  schedule.friday.enabled = false;
  schedule.friday.ranges = [];
  updateSchedule(state, schedule, NOW);
  assert.equal(state.bookings[0].status, 'CONFIRMED');
  assert.equal(state.notificationOutbox.length, 0);
});

test('expiration selects only due exceptions among mixed booking states', () => {
  const state = exceptionState();
  state.bookings[0].exceptionDeadline = NOW - 1;
  state.bookings.push(booking({ reference: 'AY-LATER', status: 'EXCEPTION', exceptionDeadline: NOW + 1 }));
  state.bookings.push(booking({ reference: 'AY-NORMAL', status: 'CONFIRMED' }));
  assert.deepEqual(expireExceptions(state, NOW), ['AY-ONE']);
  assert.deepEqual(state.bookings.map(({ status }) => status), ['CANCELLED', 'EXCEPTION', 'CONFIRMED']);
});

test('running expiration twice does not cancel the same exception twice', () => {
  const state = exceptionState();
  const deadline = state.bookings[0].exceptionDeadline;
  assert.deepEqual(expireExceptions(state, deadline), ['AY-ONE']);
  assert.deepEqual(expireExceptions(state, deadline + 1), []);
  assert.equal(state.bookings[0].cancelReason, 'EXCEPTION_DEADLINE');
});

test('exception summary exposes notice metadata without guest contact details', () => {
  const state = exceptionState();
  const summary = exceptionSummary(state);
  assert.equal(summary.bookings[0].reference, 'AY-ONE');
  assert.equal(summary.notifications[0].delivery, 'SIMULATED_NOT_SENT');
  assert.equal(JSON.stringify(summary).includes('ada@example.com'), false);
  assert.equal(JSON.stringify(summary).includes('Ada Lovelace'), false);
});
```

### Bloque 6 — Martin Flores (asignación propuesta)

**Funciones/comportamientos:** `reassignException`, `guestReassignmentSlots`, `reassignGuestException`. Cubre referencia inexistente, datos inválidos, capacidad propia, vencimiento exacto y privacidad del comprobante. **Adaptación/evaluación:** la conservación de la capacidad de acceso en la sesión se contrasta con E2E 8; la función aislada no prueba esa integración.

**Output íntegro:** [`test/unit/06-reassignment.test.js`](../test/unit/06-reassignment.test.js).

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guestReassignmentSlots, reassignException, reassignGuestException, updateSchedule } from '../../server/domain.js';
import { booking, MONDAY, NOW, seed, TOKEN_A } from './fixtures.js';

function exceptionState() {
  const state = seed();
  state.bookings.push(booking());
  const schedule = structuredClone(state.weeklyHours);
  schedule.monday.ranges = [{ start: '10:00', end: '13:00' }];
  updateSchedule(state, schedule, NOW);
  return state;
}

// Proposed allocation only: these AI-assisted tests do not assert individual authorship.
test('reassigning an unknown reference returns not found without mutation', () => {
  const state = exceptionState();
  const before = structuredClone(state);
  assert.throws(() => reassignException(state, 'AY-UNKNOWN', { date: MONDAY, time: '10:00' }, NOW),
    (error) => error.status === 404 && error.code === 'EXCEPTION_NOT_FOUND');
  assert.deepEqual(state, before);
});

test('reassignment rejects malformed date and time with field errors', () => {
  const state = exceptionState();
  const before = structuredClone(state);
  assert.throws(() => reassignException(state, 'AY-ONE', { date: '2026-09-31', time: '25:00' }, NOW),
    (error) => error.status === 400 && Boolean(error.fields.date) && Boolean(error.fields.time));
  assert.deepEqual(state, before);
});

test('the original exception does not consume its own daily capacity when reassigned', () => {
  const state = exceptionState();
  state.quickSettings.maxDailyBookings = 1;
  const result = reassignException(state, 'AY-ONE', { date: MONDAY, time: '10:00' }, NOW);
  assert.equal(result.status, 'CONFIRMED');
  assert.equal(state.bookings[0].time, '10:00');
  assert.equal(state.bookings.length, 1);
});

test('guest reassignment availability closes exactly at the deadline', () => {
  const state = exceptionState();
  const deadline = state.bookings[0].exceptionDeadline;
  assert.throws(() => guestReassignmentSlots(state, TOKEN_A, MONDAY, deadline),
    (error) => error.status === 410 && error.code === 'EXCEPTION_EXPIRED');
});

test('guest reassignment retains reference and service but omits guest details', () => {
  const state = exceptionState();
  const receipt = reassignGuestException(state, TOKEN_A, { date: MONDAY, time: '10:00' }, NOW);
  assert.equal(receipt.reference, 'AY-ONE');
  assert.equal(receipt.eventId, state.bookings[0].eventId);
  assert.equal(receipt.time, '10:00');
  assert.equal(JSON.stringify(receipt).includes('ada@example.com'), false);
});
```

### Bloque 7 — Valentin Fornes (asignación propuesta)

**Funciones/comportamientos:** `isLiveHold`, `createHold`, `findHold`, `updateSchedule`, `confirmBooking`. Cubre borde exacto del vencimiento, servicio desconocido, limpieza de holds, invalidación por horario y recuperación de comprobante. **Adaptación/evaluación:** no simula múltiples clientes de red concurrentes; E2E 6 ejerce el conflicto HTTP observable.

**Output íntegro:** [`test/unit/07-holds.test.js`](../test/unit/07-holds.test.js).

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmBooking, createHold, findHold, isLiveHold, updateSchedule } from '../../server/domain.js';
import { DEMO_EVENTS } from '../../server/seed.js';
import { MONDAY, NOW, seed, TOKEN_A, TOKEN_B } from './fixtures.js';

const selection = { eventId: DEMO_EVENTS[0].id, date: MONDAY, time: '09:00' };

// Proposed allocation only: these AI-assisted tests do not assert individual authorship.
test('a hold stops being live at its exact expiration millisecond', () => {
  const hold = { expiresAt: NOW + 15 * 60 * 1000 };
  assert.equal(isLiveHold(hold, hold.expiresAt - 1), true);
  assert.equal(isLiveHold(hold, hold.expiresAt), false);
});

test('an unknown service cannot create a hold or mutate state', () => {
  const state = seed();
  const before = structuredClone(state);
  assert.throws(() => createHold(state, { ...selection, eventId: 'unknown-service' }, NOW, TOKEN_A),
    (error) => error.status === 400);
  assert.deepEqual(state, before);
});

test('creating a hold purges expired holds but retains other active holds', () => {
  const state = seed();
  state.holds.push({ token: 'c'.repeat(64), date: '2026-09-29', time: '09:00', duration: 30, expiresAt: NOW });
  state.holds.push({ token: TOKEN_B, date: '2026-09-29', time: '09:30', duration: 30, expiresAt: NOW + 1000 });
  createHold(state, selection, NOW, TOKEN_A);
  assert.deepEqual(state.holds.map(({ token }) => token), [TOKEN_B, TOKEN_A]);
});

test('an active hold becomes unusable when edited hours remove its slot', () => {
  const state = seed();
  createHold(state, selection, NOW, TOKEN_A);
  const schedule = structuredClone(state.weeklyHours);
  schedule.monday.ranges = [{ start: '10:00', end: '13:00' }];
  updateSchedule(state, schedule, NOW);
  assert.throws(() => findHold(state, TOKEN_A, NOW),
    (error) => error.status === 409 && error.code === 'SLOT_UNAVAILABLE');
});

test('a confirmed token resolves to its receipt after the hold has expired', () => {
  const state = seed();
  const hold = createHold(state, selection, NOW, TOKEN_A);
  confirmBooking(state, TOKEN_A, { name: 'Ada Lovelace', email: 'ada@example.com' }, NOW, 'AY-ONE');
  assert.equal(state.holds.length, 0);
  assert.equal(findHold(state, TOKEN_A, hold.expiresAt + 1).receipt.reference, 'AY-ONE');
});
```

### Bloque 8 — Alejo Palavecino (asignación propuesta)

**Funciones/comportamientos:** `isValidEmail`, `validateGuest`, `createHold`, `confirmBooking`. Cubre correo válido/inválido, requeridos en blanco, opcionales de tipo incorrecto, almacenamiento normalizado y vencimiento exacto. **Adaptación/evaluación:** formato sintáctico no verifica DNS ni entrega de notificaciones; E2E 7 examina los errores visibles.

**Output íntegro:** [`test/unit/08-guests-and-bookings.test.js`](../test/unit/08-guests-and-bookings.test.js).

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidEmail, validateGuest } from '../../public/shared/validation.js';
import { confirmBooking, createHold } from '../../server/domain.js';
import { DEMO_EVENTS } from '../../server/seed.js';
import { MONDAY, NOW, seed, TOKEN_A } from './fixtures.js';

const selection = { eventId: DEMO_EVENTS[1].id, date: MONDAY, time: '09:00' };

// Proposed allocation only: these AI-assisted tests do not assert individual authorship.
test('email validation accepts plus-addressing but rejects embedded whitespace', () => {
  assert.equal(isValidEmail('ada+agenda@example.com'), true);
  assert.equal(isValidEmail('ada @example.com'), false);
});

test('guest validation treats whitespace-only required values as empty', () => {
  const errors = validateGuest({ name: '   ', email: '  ' });
  assert.ok(errors.name);
  assert.ok(errors.email);
});

test('guest validation rejects non-string optional phone and note', () => {
  const errors = validateGuest({ name: 'Ada Lovelace', email: 'ada@example.com', phone: 123, note: {} });
  assert.ok(errors.phone);
  assert.ok(errors.note);
});

test('booking trims guest fields, consumes the hold, and returns no private guest data', () => {
  const state = seed();
  createHold(state, selection, NOW, TOKEN_A);
  const receipt = confirmBooking(state, TOKEN_A,
    { name: '  Ada Lovelace  ', email: '  ada@example.com  ', phone: '  123  ', note: '  Advice  ' },
    NOW, 'AY-ONE');
  assert.deepEqual(state.bookings[0].guest,
    { name: 'Ada Lovelace', email: 'ada@example.com', phone: '123', note: 'Advice' });
  assert.equal(state.holds.length, 0);
  assert.equal(receipt.eventId, DEMO_EVENTS[1].id);
  assert.equal(JSON.stringify(receipt).includes('ada@example.com'), false);
});

test('confirmation at the hold deadline rejects without booking or notification', () => {
  const state = seed();
  const hold = createHold(state, selection, NOW, TOKEN_A);
  assert.throws(() => confirmBooking(state, TOKEN_A,
    { name: 'Ada Lovelace', email: 'ada@example.com' }, hold.expiresAt, 'AY-ONE'),
  (error) => error.status === 410 && error.code === 'HOLD_EXPIRED');
  assert.equal(state.bookings.length, 0);
  assert.equal(state.notificationOutbox.length, 0);
});
```

### Modificaciones, evaluación general y resultados

La propuesta inicial de casos se adaptó al modelo multiservicio de T3: los tests de HOLD y comprobante pasan el identificador de servicio. El último caso del bloque 8 se modificó para cubrir el borde de caducidad en lugar de repetir una aserción de idempotencia. Un caso de reserva pasada se sustituyó por preservación de un día no relacionado porque otro bloque ya cubría el pasado. Después de la primera ejecución aprobada, los archivos se renombraron por comportamiento (no por estudiante) para evitar sugerir autoría inexistente y se reutilizó un fixture común. **No hubo cambios de código productivo para que estas 40 pruebas pasaran.** La primera ejecución ya fue verde; no se fabricó una fase RED para esta caracterización.

`node --test test/unit/*.test.js` informó **40/40**. `node --test test/*.test.js test/unit/*.test.js` informó **74/74**. La IA fue eficaz para proponer casos y límites, pero la revisión humana sigue siendo necesaria para confirmar que cada aserción representa un criterio de aceptación y que cada integrante pueda defenderla. Se distingue expresamente el resultado de ejecución de la responsabilidad individual pendiente.

## 6. Reflexión estructurada

**1. Trazabilidad.** La especificación permitió derivar los flujos principales, pero no directamente todos los tests: TP1, TP2 y el tablero reutilizan algunos identificadores RF con significados distintos, y US_006 contradice su propia conversación con el criterio de aceptación. También había listas de motivos diferentes para bloqueo individual y por rango. Elegir explícitamente los criterios de aceptación de Trello/TP2 y vincular cada test con ID de historia, comportamiento y fuente evitó que una coincidencia de número ocultara diferencias de negocio.

**2. Valor de testear.** Las pruebas revelaron durante T1 una regresión en la separación de horarios entre franjas adyacentes: una corrida enfocada quedó en 10/11 antes de corregir la regla. Las verificaciones de datos inválidos y de colisión en Cypress luego confirmaron que no se guardan cambios inconsistentes ni se duplica una reserva. Esto muestra que testear no es solo obtener un contador verde: obliga a observar el estado final y a corregir la lógica cuando un caso de borde contradice lo esperado.

**3. Uso de IA.** La asistencia fue especialmente útil para enumerar y redactar los 40 casos unitarios de reglas, fechas, bloqueos, excepciones y reservas con un mismo prompt; los E2E requirieron mayor atención al estado del navegador, los selectores y el reloj del servidor. La IA no puede certificar que la aserción coincide con el negocio, que se entregó un correo real ni que ocho estudiantes comprenden los tests. Por eso se conservaron el prompt y la salida, se documentaron las adaptaciones y se dejó pendiente la revisión individual.

## 7. Lecciones aprendidas

**Diseñar para poder probar.** Separar reglas de dominio de la interfaz y permitir la inyección de reloj y estado hizo posible cubrir el borde de 15 minutos y el plazo de 24 horas sin esperar tiempo real. Los selectores `data-cy` evitaron acoplar Cypress a clases CSS o textos de presentación. La mejora futura es mantener esa separación cuando se agreguen nuevas reglas, sin convertir la demo en un producto más amplio que el alcance acordado.

**La IA acelera, pero no valida la comprensión.** Un prompt compartido produjo casos útiles y ejecutables, pero varios necesitaron adaptación al catálogo de servicios y una revisión de nombres para no insinuar autoría personal. La siguiente instancia de trabajo del equipo es que cada integrante examine sus cinco pruebas y su recorrido E2E, proponga cambios si corresponde y pueda explicar por qué cada resultado esperado es correcto.

**La ambigüedad se convierte en una falla de prueba si no se resuelve.** Los identificadores RF discordantes y las políticas opuestas para US_006 habrían permitido escribir tests incompatibles entre sí. Registrar la fuente que prevalece y las concesiones de la demo preservó la trazabilidad; para trabajos futuros, el equipo debería aclarar estos conflictos antes de codificar.

**Evidencia no es autoría ni capacidad de producción.** Los logs y el video prueban una ejecución local de 74 casos Node y ocho Cypress, pero no un envío de email, un sistema autenticado, compatibilidad multi-navegador ni la participación individual de cada estudiante. El informe final debe conservar estas distinciones y completar la presentación en clase y la validación del equipo.
