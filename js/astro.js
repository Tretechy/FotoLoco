// Berechnungen für Sonne, Mond und Milchstraße – immer in der Ortszeit des Spots.
// Erwartet SunCalc und tzlookup als globale Funktionen (vendor/suncalc.js, vendor/tz-lookup.js).

const SC = () => globalThis.SunCalc;
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const MIN = 6e4;

// Fotografen-Definitionen (wie in gängigen Planer-Apps):
// Blaue Stunde: Sonne zwischen −6° und −4°, Goldene Stunde: zwischen −4° und +6°.
export const BLUE_LOW = -6, GOLD_LOW = -4, GOLD_HIGH = 6, ASTRO_DARK = -18;

let added = false;
function ensureTimes(){
  if (added) return;
  SC().addTime(GOLD_LOW, "goldStartMorning", "goldEndEvening");
  added = true;
}

/* ---------- Zeitzonen ---------- */
export function tzFor(lat, lng){
  try { return globalThis.tzlookup(lat, lng) || "UTC"; } catch { return "UTC"; }
}
const partsCache = new Map();
function partsFmt(tz){
  if (!partsCache.has(tz)) partsCache.set(tz, new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"
  }));
  return partsCache.get(tz);
}
export function localParts(date, tz){
  const p = {};
  for (const x of partsFmt(tz).formatToParts(date)) if (x.type !== "literal") p[x.type] = +x.value;
  return {y: p.year, m: p.month, d: p.day, h: p.hour % 24, min: p.minute, s: p.second};
}
// Abstand der Zeitzone zu UTC in Minuten zu einem Zeitpunkt (z. B. +120 für Sommerzeit in Berlin).
export function tzOffset(date, tz){
  const p = localParts(date, tz);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - date.getTime()) / MIN);
}
// Zeitpunkt für "Datum + Minuten seit Mitternacht" in der Zeitzone tz.
export function zonedTime(dateStr, minutes, tz){
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let t = guess - tzOffset(new Date(guess), tz) * MIN;
  t = guess - tzOffset(new Date(t), tz) * MIN; // zweiter Durchlauf für Tage mit Zeitumstellung
  return new Date(t);
}
export function minutesOfDay(date, tz){ const p = localParts(date, tz); return p.h * 60 + p.min; }
export function dateInTz(date, tz){ const p = localParts(date, tz); return p.y + "-" + String(p.m).padStart(2, "0") + "-" + String(p.d).padStart(2, "0"); }
export function addDays(dateStr, n){
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
const timeCache = new Map();
export function fmtTime(date, tz){
  if (!(date instanceof Date) || isNaN(date)) return "—";
  if (!timeCache.has(tz)) timeCache.set(tz, new Intl.DateTimeFormat("de-DE", {timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23"}));
  return timeCache.get(tz).format(date);
}

/* ---------- Positionen ---------- */
const bearing = az => (deg(az) + 180 + 360) % 360; // SunCalc misst von Süden, wir von Norden
export function sunPos(date, lat, lng){ const p = SC().getPosition(date, lat, lng); return {alt: deg(p.altitude), b: bearing(p.azimuth)}; }
export function moonPos(date, lat, lng){ const p = SC().getMoonPosition(date, lat, lng); return {alt: deg(p.altitude), b: bearing(p.azimuth)}; }
// Zentrum der Milchstraße (galaktisches Zentrum, Rektaszension 266,405°, Deklination −29,008°)
export function corePos(date, lat, lng){
  const jd = date.getTime() / 864e5 + 2440587.5;
  const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545)) % 360;
  const H = rad(((gmst + lng - 266.405) % 360 + 360) % 360), dec = rad(-29.008), phi = rad(lat);
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return {alt: deg(alt), b: (deg(az) + 180 + 360) % 360};
}
export function phase(alt){ return alt < BLUE_LOW ? "night" : alt < GOLD_LOW ? "blue" : alt < GOLD_HIGH ? "gold" : "day"; }
export const PHASE_LABEL = {night: "Nacht", blue: "Blaue Stunde", gold: "Goldene Stunde", day: "Tag"};

/* ---------- Tageszeiten ---------- */
export function sunTimes(lat, lng, dateStr, tz){
  ensureTimes();
  const noon = zonedTime(dateStr, 12 * 60, tz);
  const t = SC().getTimes(noon, lat, lng);
  const ok = d => d instanceof Date && !isNaN(d);
  return {
    blueMorning: [t.dawn, t.goldStartMorning],
    sunrise: t.sunrise,
    goldMorning: [t.goldStartMorning, t.goldenHourEnd],
    goldEvening: [t.goldenHour, t.goldEndEvening],
    sunset: t.sunset,
    blueEvening: [t.goldEndEvening, t.dusk],
    sunriseBearing: ok(t.sunrise) ? sunPos(t.sunrise, lat, lng).b : null,
    sunsetBearing: ok(t.sunset) ? sunPos(t.sunset, lat, lng).b : null
  };
}
// Sonnenhöhe für jeden 5-Minuten-Schritt des lokalen Tages (288 Werte) – für den Farbbalken.
export function dayProfile(lat, lng, dateStr, tz){
  const start = zonedTime(dateStr, 0, tz).getTime();
  const out = [];
  for (let i = 0; i < 288; i++) out.push(sunPos(new Date(start + i * 5 * MIN), lat, lng).alt);
  return out;
}

/* ---------- Nacht: Milchstraße und Mond ---------- */
// Betrachtet die Nacht, die am gewählten Abend beginnt (12:00 bis 12:00 Uhr Ortszeit).
export function nightInfo(lat, lng, dateStr, tz){
  const start = zonedTime(dateStr, 12 * 60, tz).getTime();
  const STEP = 5 * MIN, N = 288;
  let dark = false, win = null, best = null, moonRise = null, moonSet = null, moonSteps = 0, winSteps = 0;
  let prevMoon = null;
  for (let i = 0; i <= N; i++){
    const t = new Date(start + i * STEP);
    const sun = sunPos(t, lat, lng).alt, core = corePos(t, lat, lng), moon = moonPos(t, lat, lng).alt;
    if (sun < ASTRO_DARK) dark = true;
    if (prevMoon !== null){
      if (prevMoon < 0 && moon >= 0 && !moonRise) moonRise = t;
      if (prevMoon >= 0 && moon < 0 && !moonSet) moonSet = t;
    }
    prevMoon = moon;
    if (sun < ASTRO_DARK && core.alt > 5){
      if (!win) win = {from: t, to: t}; else if (!win.done) win.to = t;
      if (!win.done){
        winSteps++; if (moon > 0) moonSteps++;
        if (!best || core.alt > best.alt) best = {t, alt: core.alt, b: core.b};
      }
    } else if (win) win.done = true;
  }
  const moonFrac = SC().getMoonIllumination(best ? best.t : new Date(start + 12 * 60 * MIN)).fraction;
  const moonUpShare = winSteps ? moonSteps / winSteps : 0;
  // Störender Mond: hell (über 40 %) und mehr als ein Viertel des Fensters über dem Horizont
  const moonDisturbs = !!win && moonFrac > 0.4 && moonUpShare > 0.25;
  return {dark, win: win && {from: win.from, to: win.to}, best, moonFrac, moonUpShare, moonDisturbs, moonRise, moonSet};
}

/* ---------- Karte ---------- */
export function destination(lat, lng, b, meters){
  const R = 6371e3, d = meters / R, br = rad(b), p1 = rad(lat), l1 = rad(lng);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(br));
  const l2 = l1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [deg(l2), deg(p2)]; // [lng, lat] wie in GeoJSON
}
export function distanceKm(a, b){
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const DIRS = ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"];
export const compass = b => DIRS[Math.round(b / 22.5) % 16];
export const fmtBearing = b => b == null ? "—" : Math.round(b) + "° " + compass(b);
