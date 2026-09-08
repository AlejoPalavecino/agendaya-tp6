import { api } from './api.js';
import { displayFieldErrors, escapeHtml as safe, showConflict, toast } from './ui.js';
import { formatDate, minutesToTime, timeToMinutes, WEEK_DAYS } from '../shared/dates.js';
import { BLOCK_REASONS, validateBlock, validateSchedule } from '../shared/validation.js';

export class AdminView {
  constructor(onSaved) {
    this.onSaved = onSaved;
    this.weeklyHours = null;
    this.blockedDays = [];
    this.busy = false;
    this.root = document.getElementById('admin-content');
    this.root.addEventListener('change', (event) => this.onChange(event));
    this.root.addEventListener('input', (event) => this.onInput(event));
    this.root.addEventListener('click', (event) => this.onClick(event));
    this.root.addEventListener('submit', (event) => this.onSubmit(event));
  }

  async initialize() {
    const result = await api('/api/admin/availability');
    this.weeklyHours = result.weeklyHours;
    this.blockedDays = result.blockedDays;
    this.render();
  }

  render() {
    this.root.innerHTML = `<div class="admin-layout">
      <section class="admin-card" aria-labelledby="schedule-heading"><div class="card-heading"><p class="eyebrow">01 / TU SEMANA HABITUAL</p><h2 id="schedule-heading">Horarios de atención</h2><p>Activa los días laborables y define hasta 3 franjas por día.</p></div>
      <form class="schedule-form" id="schedule-form" novalidate data-cy="schedule-form"><div class="week-editor" id="week-editor">${WEEK_DAYS.map((day) => this.renderDay(day)).join('')}</div>
      <div class="schedule-footer"><p>Hora local de Buenos Aires. Los turnos ya confirmados se conservan.</p><button type="submit" class="button primary" data-cy="save-schedule">Guardar horarios <span aria-hidden="true">↗</span></button></div>
      <p id="schedule-error" class="field-error" role="alert" data-cy="schedule-error"></p></form></section>
      <aside class="admin-side">
        <section class="admin-card" aria-labelledby="block-heading"><div class="card-heading"><p class="eyebrow">02 / UNA PAUSA NECESARIA</p><h2 id="block-heading">Bloquear un día</h2><p>Deja una fecha fuera de tu agenda pública.</p></div>
        <div class="block-content"><form class="block-form" id="block-form" novalidate data-cy="block-day-form">
        <div class="field"><label for="block-date">Fecha <span>*</span></label><input type="date" id="block-date" name="date" required aria-describedby="block-date-error" data-cy="block-date"><p id="block-date-error" class="field-error" data-cy="block-date-error"></p></div>
        <div class="field"><label for="block-reason">Motivo <span>*</span></label><select id="block-reason" name="reason" required aria-describedby="block-reason-error" data-cy="block-reason"><option value="">Selecciona un motivo</option>${BLOCK_REASONS.map((reason) => `<option value="${safe(reason)}">${safe(reason)}</option>`).join('')}</select><p id="block-reason-error" class="field-error" data-cy="block-reason-error"></p></div>
        <button class="button coral full-width" type="submit" data-cy="block-day">Bloquear este día <span aria-hidden="true">↗</span></button><p id="block-submit-error" class="field-error" role="alert" data-cy="block-submit-error"></p>
        </form><p class="block-note">Si la fecha tiene turnos confirmados, el sistema te avisará y no permitirá bloquearla.</p></div></section>
        <section class="admin-card" aria-labelledby="blocked-heading"><div class="card-heading"><h2 id="blocked-heading">Días bloqueados</h2><p>Estas fechas no admiten nuevas reservas.</p></div><div id="blocked-days" data-cy="blocked-days">${this.renderBlockedDays()}</div></section>
        <p class="scope-note">Administración simulada, sin inicio de sesión. En la demo compartida, cualquier persona con el enlace puede cambiar horarios y bloquear fechas.</p>
      </aside>
    </div>`;
  }

  renderDay({ key, label }) {
    const day = this.weeklyHours[key];
    return `<div class="day-row" data-day-row="${key}"><label class="day-switch"><input type="checkbox" data-cy="working-day-toggle" data-day="${key}" aria-label="Habilitar ${label}" ${day.enabled ? 'checked' : ''}><span>${label}</span></label>
    <div class="day-ranges">${day.enabled ? `<div class="range-list">${day.ranges.map((range, index) => `<div><div class="range-row"><label class="sr-only" for="${key}-${index}-start">Inicio de ${label}, franja ${index + 1}</label><input class="time-input" type="time" step="60" required id="${key}-${index}-start" data-day="${key}" data-index="${index}" data-edge="start" data-cy="range-start" aria-describedby="${key}-${index}-error" value="${safe(range.start)}"><span aria-hidden="true">a</span><label class="sr-only" for="${key}-${index}-end">Fin de ${label}, franja ${index + 1}</label><input class="time-input" type="time" step="60" required id="${key}-${index}-end" data-day="${key}" data-index="${index}" data-edge="end" data-cy="range-end" aria-describedby="${key}-${index}-error" value="${safe(range.end)}"><button class="range-remove" type="button" data-cy="remove-range" data-day="${key}" data-index="${index}" aria-label="Quitar franja ${index + 1} de ${label}" ${day.ranges.length === 1 ? 'disabled' : ''}>×</button></div><p class="field-error" id="${key}-${index}-error" data-cy="range-error"></p></div>`).join('')}</div><button type="button" class="add-range" data-cy="add-range" data-day="${key}" ${day.ranges.length >= 3 ? 'disabled' : ''}><span aria-hidden="true">+</span> ${day.ranges.length >= 3 ? 'Máximo de 3 franjas' : 'Agregar franja'}</button>` : '<div class="day-disabled">Sin atención</div>'}<p class="field-error" id="${key}-error" data-cy="day-error"></p></div></div>`;
  }

  renderBlockedDays() {
    if (!this.blockedDays.length) return '<p class="blocked-empty">Tu agenda no tiene días bloqueados.<br>Las pausas que guardes aparecerán aquí.</p>';
    return `<ul class="blocked-list">${this.blockedDays.map((day) => `<li class="blocked-item" data-cy="blocked-day" data-date="${day.date}"><div><strong>${safe(formatDate(day.date, { year: 'numeric' }))}</strong><small>${safe(day.reason)}</small></div><span class="blocked-tag">No disponible</span></li>`).join('')}</ul>`;
  }

  redrawDay(key) {
    this.root.querySelector(`[data-day-row="${key}"]`).outerHTML = this.renderDay(WEEK_DAYS.find((day) => day.key === key));
  }

  onChange(event) {
    const input = event.target;
    if (input.dataset.cy !== 'working-day-toggle' || this.busy) return;
    const day = this.weeklyHours[input.dataset.day];
    day.enabled = input.checked;
    if (day.enabled && !day.ranges.length) day.ranges = [{ start: '09:00', end: '17:00' }];
    this.redrawDay(input.dataset.day);
    this.root.querySelector(`[data-day="${input.dataset.day}"][data-cy="working-day-toggle"]`).focus({ preventScroll: true });
  }

  onInput(event) {
    const input = event.target;
    if (!input.dataset.edge || this.busy) return;
    this.weeklyHours[input.dataset.day].ranges[Number(input.dataset.index)][input.dataset.edge] = input.value;
  }

  onClick(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled || this.busy || !button.dataset.day) return;
    const key = button.dataset.day;
    const day = this.weeklyHours[key];
    if (button.dataset.cy === 'add-range' && day.ranges.length < 3) {
      const latest = Math.max(...day.ranges.map((range) => timeToMinutes(range.end) ?? 0));
      const start = latest < 1380 ? minutesToTime(latest) : '';
      const end = latest < 1380 ? minutesToTime(Math.min(latest + 60, 1439)) : '';
      day.ranges.push({ start, end });
      this.redrawDay(key);
      this.root.querySelector(`#${key}-${day.ranges.length - 1}-start`).focus();
    } else if (button.dataset.cy === 'remove-range' && day.ranges.length > 1) {
      day.ranges.splice(Number(button.dataset.index), 1);
      this.redrawDay(key);
      this.root.querySelector(`[data-cy="add-range"][data-day="${key}"]`).focus();
    }
  }

  showScheduleErrors(errors) {
    this.root.querySelectorAll('.time-input').forEach((input) => input.removeAttribute('aria-invalid'));
    this.root.querySelectorAll('#schedule-form .field-error').forEach((field) => { field.textContent = ''; });
    for (const [key, message] of Object.entries(errors)) {
      const container = this.root.querySelector(`#${CSS.escape(`${key}-error`)}`);
      if (container) container.textContent = message;
      for (const edge of ['start', 'end']) this.root.querySelector(`#${CSS.escape(`${key}-${edge}`)}`)?.setAttribute('aria-invalid', 'true');
    }
    this.root.querySelector('[aria-invalid="true"]')?.focus();
  }

  async onSubmit(event) {
    event.preventDefault();
    if (this.busy) return;
    const form = event.target;
    if (form.id === 'schedule-form') {
      const errors = validateSchedule(this.weeklyHours);
      this.showScheduleErrors(errors);
      if (Object.keys(errors).length) { toast('No se guardaron los cambios. Revisa las franjas horarias.', 'error'); return; }
      this.busy = true;
      const controls = [...form.querySelectorAll('button, input')];
      controls.forEach((element) => { element.dataset.wasDisabled = String(element.disabled); element.disabled = true; });
      const button = form.querySelector('[type="submit"]');
      button.textContent = 'Guardando…';
      try {
        await api('/api/admin/availability', { method: 'PUT', body: { weeklyHours: this.weeklyHours } });
        toast('Horarios guardados correctamente.');
        this.onSaved();
      } catch (error) { this.showScheduleErrors(error.fields || {}); this.root.querySelector('#schedule-error').textContent = error.message; toast(error.message, 'error'); }
      finally {
        controls.forEach((element) => { element.disabled = element.dataset.wasDisabled === 'true'; });
        button.innerHTML = 'Guardar horarios <span aria-hidden="true">↗</span>'; this.busy = false;
      }
    } else if (form.id === 'block-form') {
      const input = Object.fromEntries(new FormData(form));
      const errors = validateBlock(input);
      displayFieldErrors(form, errors, 'block-');
      if (Object.keys(errors).length) { toast('Selecciona una fecha y un motivo para bloquear el día.', 'error'); return; }
      this.busy = true;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true; button.textContent = 'Guardando…';
      try {
        const blocked = await api('/api/admin/blocked-days', { method: 'POST', body: input });
        this.blockedDays.push(blocked); this.blockedDays.sort((left, right) => left.date.localeCompare(right.date));
        this.root.querySelector('#blocked-days').innerHTML = this.renderBlockedDays();
        form.reset(); toast('Día bloqueado exitosamente'); this.onSaved();
      } catch (error) {
        if (error.code === 'BOOKING_CONFLICT') { showConflict(error.message); toast('El día tiene turnos confirmados. No se guardaron cambios.', 'error'); }
        else { displayFieldErrors(form, error.fields || {}, 'block-'); form.querySelector('#block-submit-error').textContent = error.message; toast(error.message, 'error'); }
      } finally { button.disabled = false; button.innerHTML = 'Bloquear este día <span aria-hidden="true">↗</span>'; this.busy = false; }
    }
  }
}
