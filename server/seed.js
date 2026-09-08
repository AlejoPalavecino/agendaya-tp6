import { WEEK_DAYS } from '../public/shared/dates.js';

export const DEMO_PROFILE = {
  name: 'Lucía Méndez', initials: 'LM', role: 'Consultoría profesional',
  description: 'Un espacio para ordenar tus ideas, conversar sobre tus objetivos y dar forma a tu próximo paso.',
};
export const DEMO_EVENT = {
  id: 'advisory-session', name: 'Sesión de asesoramiento', duration: 30,
  format: 'Encuentro virtual', timezone: 'America/Argentina/Buenos_Aires',
};

export function createSeedState() {
  return {
    schemaVersion: 1,
    weeklyHours: Object.fromEntries(WEEK_DAYS.map(({ key }, index) => [key, {
      enabled: index < 5,
      ranges: index < 5 ? [{ start: '09:00', end: '13:00' }, { start: '15:00', end: '18:00' }] : [],
    }])),
    blockedDays: [], holds: [], bookings: [],
  };
}
