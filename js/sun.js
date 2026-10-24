// Zonsopkomst/-ondergang, schemering en gouden uur (astronomische benadering, nauwkeurig tot ±1 minuut).
// Gebaseerd op de formules uit de NOAA/“SunCalc”-methode.

const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397, J0 = 0.0009;
const toDays = (date) => date.valueOf() / dayMs - 0.5 + J1970 - J2000;
const fromJulian = (j) => new Date((j + 0.5 - J1970) * dayMs);
const declination = (l) => Math.asin(Math.sin(e) * Math.sin(l));
const meanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
const eclipticLong = (M) => M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
const transitJ = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
const hourAngle = (h, phi, d) => Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));

const ANGLES = [[-0.833, 'sunrise', 'sunset'], [-6, 'dawn', 'dusk'], [-4, 'blueEnd', 'blueStart'], [6, 'goldenEnd', 'goldenStart']];

/** @param {Date} date  @returns {{sunrise,sunset,dawn,dusk,blueEnd,blueStart,goldenEnd,goldenStart,noon: Date}} */
export function sunTimes(date, lat, lon) {
  const lw = rad * -lon, phi = rad * lat;
  const d = toDays(date);
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = meanAnomaly(ds), L = eclipticLong(M), dec = declination(L);
  const Jnoon = transitJ(ds, M, L);
  const res = { noon: fromJulian(Jnoon) };
  for (const [a, rise, set] of ANGLES) {
    const w = hourAngle(a * rad, phi, dec);
    const Jset = transitJ(J0 + (w + lw) / (2 * Math.PI) + n, M, L);
    res[rise] = isNaN(w) ? null : fromJulian(Jnoon - (Jset - Jnoon));
    res[set] = isNaN(w) ? null : fromJulian(Jset);
  }
  return res;
}

export const hhmm = (d) => (d && !isNaN(d) ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '—');
