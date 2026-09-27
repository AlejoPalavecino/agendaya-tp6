import { datesInMonth, dayKey, isValidDate, localDate, minutesToTime, slotTimestamp, timeToMinutes } from '../public/shared/dates.js';
import { normalizeSchedule, validateBlock, validateGuest, validateQuickSettings, validateSchedule } from '../public/shared/validation.js';
import { DEFAULT_QUICK_SETTINGS, DEMO_EVENT } from './seed.js';

export const HOLD_DURATION_MS = 15 * 60 * 1000;

export class DomainError extends Error {
  constructor(message, status = 400, fields = {}, code = 'INVALID_INPUT', details = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.code = code;
    this.details = details;
  }
}

function requireValid(errors) {
  if (Object.keys(errors).length) throw new DomainError('Revisa los datos indicados.', 400, errors);
}

export function isLiveHold(hold, now) { return hold.expiresAt > now; }

// Existing schema-v1 files predate quick settings; use defaults until first save.
export function quickSettingsOf(state) {
  return { ...DEFAULT_QUICK_SETTINGS, ...state.quickSettings };
}

export function updateQuickSettings(state, settings) {
  requireValid(validateQuickSettings(settings));
  state.quickSettings = {
    maxDailyBookings: settings.maxDailyBookings,
    intervalMinutes: settings.intervalMinutes,
    leadHours: settings.leadHours,
  };
  return { quickSettings: state.quickSettings };
}

export function scheduledSlots(state, date, now) {
  if (!isValidDate(date) || date < localDate(now)) return [];
  if (state.blockedDays.some((blocked) => blocked.date === date)) return [];
  const day = state.weeklyHours[dayKey(date)];
  if (!day.enabled) return [];
  const { intervalMinutes, leadHours } = quickSettingsOf(state);
  const slots = [];
  let nextStart = 0;
  for (const range of [...day.ranges].sort((left, right) => timeToMinutes(left.start) - timeToMinutes(right.start))) {
    const end = timeToMinutes(range.end);
    for (let minute = Math.max(timeToMinutes(range.start), nextStart); minute + DEMO_EVENT.duration <= end; minute += DEMO_EVENT.duration + intervalMinutes) {
      const time = minutesToTime(minute);
      if (slotTimestamp(date, time) >= now + leadHours * 60 * 60 * 1000) slots.push(time);
      nextStart = minute + DEMO_EVENT.duration + intervalMinutes;
    }
  }
  return slots;
}

function overlaps(date, time, record, intervalMinutes) {
  if (record.date !== date) return false;
  const start = timeToMinutes(time);
  const otherStart = timeToMinutes(record.time);
  return start < otherStart + (record.duration || DEMO_EVENT.duration) + intervalMinutes
    && start + DEMO_EVENT.duration + intervalMinutes > otherStart;
}

export function availableSlots(state, date, now, ownToken = null) {
  const { maxDailyBookings, intervalMinutes } = quickSettingsOf(state);
  const confirmedCount = state.bookings.filter((booking) => booking.date === date).length;
  const activeHoldCount = state.holds.filter((hold) => hold.date === date && hold.token !== ownToken && isLiveHold(hold, now)).length;
  if (confirmedCount + activeHoldCount >= maxDailyBookings) return [];
  return scheduledSlots(state, date, now).filter((time) => {
    const booked = state.bookings.some((booking) => overlaps(date, time, booking, intervalMinutes));
    const held = state.holds.some((hold) => hold.token !== ownToken && isLiveHold(hold, now) && overlaps(date, time, hold, intervalMinutes));
    return !booked && !held;
  });
}

export function monthlyAvailability(state, month, now) {
  return datesInMonth(month).map((date) => ({ date, slots: availableSlots(state, date, now) }));
}

export function updateSchedule(state, schedule) {
  requireValid(validateSchedule(schedule));
  state.weeklyHours = normalizeSchedule(schedule);
  // Existing confirmed bookings remain intact, including those outside the new schedule.
  return { weeklyHours: state.weeklyHours };
}

export function blockDay(state, input) {
  requireValid(validateBlock(input));
  const count = state.bookings.filter((booking) => booking.date === input.date).length;
  if (count) {
    throw new DomainError(`No puedes bloquear este día porque tienes ${count} ${count === 1 ? 'turno agendado' : 'turnos agendados'}. Cancélalos o prográmalos primero.`, 409, {}, 'BOOKING_CONFLICT', { count });
  }
  if (state.blockedDays.some((blocked) => blocked.date === input.date)) {
    throw new DomainError('Este día ya está bloqueado.', 409, { date: 'Selecciona otra fecha.' }, 'ALREADY_BLOCKED');
  }
  const blocked = { date: input.date, reason: input.reason };
  state.blockedDays.push(blocked);
  state.blockedDays.sort((left, right) => left.date.localeCompare(right.date));
  return blocked;
}

export function createHold(state, input, now, token) {
  if (input?.eventId !== DEMO_EVENT.id || !isValidDate(input?.date) || timeToMinutes(input?.time) === null) {
    throw new DomainError('Selecciona una fecha y un horario válidos.');
  }
  state.holds = state.holds.filter((hold) => isLiveHold(hold, now));
  if (!availableSlots(state, input.date, now).includes(input.time)) {
    throw new DomainError('Este horario ya no está disponible. Selecciona otro.', 409, {}, 'SLOT_UNAVAILABLE');
  }
  const hold = {
    token, eventId: DEMO_EVENT.id, date: input.date, time: input.time,
    duration: DEMO_EVENT.duration, expiresAt: now + HOLD_DURATION_MS,
  };
  state.holds.push(hold);
  return { ...hold, serverNow: now };
}

export function bookingReceipt(booking) {
  return {
    reference: booking.reference, date: booking.date, time: booking.time,
    eventName: DEMO_EVENT.name, duration: booking.duration, status: 'CONFIRMED',
    notifications: { guestEmail: 'simulated', administrator: 'simulated' },
  };
}

export function findHold(state, token, now) {
  const booking = state.bookings.find((item) => item.holdToken === token);
  if (booking) return { receipt: bookingReceipt(booking), serverNow: now };
  const hold = state.holds.find((item) => item.token === token);
  if (!hold || !isLiveHold(hold, now)) {
    throw new DomainError('El tiempo de reserva finalizó. Selecciona nuevamente un horario.', 410, {}, 'HOLD_EXPIRED');
  }
  if (!availableSlots(state, hold.date, now, token).includes(hold.time)) {
    throw new DomainError('La disponibilidad cambió. Selecciona otro horario.', 409, {}, 'SLOT_UNAVAILABLE');
  }
  return { ...hold, serverNow: now };
}

export function confirmBooking(state, token, guest, now, reference) {
  const previous = state.bookings.find((item) => item.holdToken === token);
  if (previous) return bookingReceipt(previous);
  requireValid(validateGuest(guest));
  const hold = findHold(state, token, now);
  const booking = {
    reference, holdToken: token, eventId: hold.eventId,
    date: hold.date, time: hold.time, duration: DEMO_EVENT.duration,
    guest: { name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone?.trim() || '', note: guest.note?.trim() || '' },
    status: 'CONFIRMED', createdAt: now,
  };
  state.bookings.push(booking);
  state.holds = state.holds.filter((item) => item.token !== token);
  return bookingReceipt(booking);
}
