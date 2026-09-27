import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { isValidMonth, localDate } from '../public/shared/dates.js';
import { blockDay, confirmBooking, createHold, DomainError, findHold, monthlyAvailability, quickSettingsOf, updateQuickSettings, updateSchedule } from './domain.js';
import { DEMO_EVENT, DEMO_PROFILE } from './seed.js';

const PUBLIC_DIRECTORY = fileURLToPath(new URL('../public/', import.meta.url));
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ...['app', 'api', 'ui', 'booking', 'admin'].map((name) => [`/js/${name}.js`, [`js/${name}.js`, 'text/javascript; charset=utf-8']]),
  ...['dates', 'validation'].map((name) => [`/shared/${name}.js`, [`shared/${name}.js`, 'text/javascript; charset=utf-8']]),
]);

async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) {
    throw new DomainError('Se requiere contenido JSON.', 415);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32768) throw new DomainError('La solicitud es demasiado grande.', 413);
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid object');
    return data;
  } catch { throw new DomainError('El contenido JSON no es válido.'); }
}

export function createApplication({ store, trustedHosts, clock = Date.now, createToken = () => randomBytes(32).toString('hex') }) {
  const cloudHosts = trustedHosts ? new Set(trustedHosts) : null;
  return createServer(async (request, response) => {
    const send = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(data));
    };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    try {
      const host = (request.headers.host || '').toLowerCase();
      const allowed = cloudHosts ? cloudHosts.has(host) : /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
      if (!allowed) throw new DomainError('Host no permitido.', 403);
      const origin = `${cloudHosts ? 'https' : 'http'}://${host}`;
      if (request.headers.origin && request.headers.origin !== origin) throw new DomainError('Origen no permitido.', 403);
      const url = new URL(request.url, origin);
      const path = url.pathname;
      const method = request.method;
      if (method === 'GET' && path === '/api/config') {
        return send(200, { profile: DEMO_PROFILE, event: DEMO_EVENT, serverNow: clock(), today: localDate(clock()) });
      }
      if (method === 'GET' && path === '/api/availability') {
        const month = url.searchParams.get('month');
        if (!isValidMonth(month)) throw new DomainError('El mes debe tener formato AAAA-MM.');
        const now = clock();
        return send(200, { month, days: monthlyAvailability(await store.read(), month, now), serverNow: now, today: localDate(now) });
      }
      if (method === 'GET' && path === '/api/admin/availability') {
        const state = await store.read();
        return send(200, { weeklyHours: state.weeklyHours, blockedDays: state.blockedDays, quickSettings: quickSettingsOf(state) });
      }
      if (method === 'PUT' && path === '/api/admin/quick-settings') {
        const body = await readJson(request);
        return send(200, await store.mutate((state) => updateQuickSettings(state, body)));
      }
      if (method === 'PUT' && path === '/api/admin/availability') {
        const body = await readJson(request);
        return send(200, await store.mutate((state) => updateSchedule(state, body.weeklyHours)));
      }
      if (method === 'POST' && path === '/api/admin/blocked-days') {
        const body = await readJson(request);
        return send(201, await store.mutate((state) => blockDay(state, body)));
      }
      if (method === 'POST' && path === '/api/holds') {
        const body = await readJson(request);
        return send(201, await store.mutate((state) => createHold(state, body, clock(), createToken())));
      }
      const holdRoute = path.match(/^\/api\/holds\/([a-f0-9]{64})$/);
      if (holdRoute && method === 'GET') return send(200, findHold(await store.read(), holdRoute[1], clock()));
      if (holdRoute && method === 'DELETE') {
        await store.mutate((state) => {
          state.holds = state.holds.filter((hold) => hold.token !== holdRoute[1]);
          return null;
        });
        return send(200, { released: true });
      }
      if (method === 'POST' && path === '/api/bookings') {
        const body = await readJson(request);
        if (typeof body.holdToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.holdToken)) throw new DomainError('La selección del horario no es válida.');
        return send(201, await store.mutate((state) => confirmBooking(state, body.holdToken, body.guest || {}, clock(), `AY-${randomBytes(5).toString('hex').toUpperCase()}`)));
      }
      if ((method === 'GET' || method === 'HEAD') && STATIC_FILES.has(path)) {
        const [file, mime] = STATIC_FILES.get(path);
        const content = await readFile(join(PUBLIC_DIRECTORY, file));
        response.writeHead(200, { 'Content-Type': mime });
        return response.end(method === 'HEAD' ? undefined : content);
      }
      send(404, { message: 'Recurso no encontrado.', code: 'NOT_FOUND' });
    } catch (error) {
      if (response.headersSent) return response.end();
      if (error instanceof DomainError) return send(error.status, { message: error.message, code: error.code, fields: error.fields, ...error.details });
      console.error('Request failed:', error.message);
      send(500, { message: 'No se pudieron guardar los cambios. Intenta nuevamente.', code: 'INTERNAL_ERROR' });
    }
  });
}
