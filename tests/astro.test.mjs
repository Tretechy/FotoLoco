// Tests für den Rechenkern. Ausführen mit: npm test
// Läuft absichtlich in der Zeitzone Asia/Tokyo, um zu prüfen, dass die Ergebnisse
// nicht von der Zeitzone des Geräts abhängen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.SunCalc = require("../vendor/suncalc.js");
globalThis.tzlookup = require("../vendor/tz-lookup.js");
const A = await import("../js/astro.js");

const near = (date, tz, hhmm, tolMin = 3) => {
  const [h, m] = hhmm.split(":").map(Number);
  const got = A.minutesOfDay(date, tz), want = h * 60 + m;
  assert.ok(Math.abs(got - want) <= tolMin, `erwartet ~${hhmm}, bekommen ${A.fmtTime(date, tz)}`);
};

test("Zeitzone wird aus Koordinaten bestimmt", () => {
  assert.equal(A.tzFor(52.52, 13.405), "Europe/Berlin");
  assert.equal(A.tzFor(38.72, -9.14), "Europe/Lisbon");
  assert.equal(A.tzFor(64.15, -21.94), "Atlantic/Reykjavik");
});

test("zonedTime berücksichtigt Sommerzeit", () => {
  assert.equal(A.zonedTime("2026-03-29", 12 * 60, "Europe/Berlin").toISOString(), "2026-03-29T10:00:00.000Z");
  assert.equal(A.zonedTime("2026-01-15", 12 * 60, "Europe/Berlin").toISOString(), "2026-01-15T11:00:00.000Z");
});

test("Sonnenauf- und -untergang Berlin zur Sommersonnenwende", () => {
  const t = A.sunTimes(52.52, 13.405, "2026-06-21", "Europe/Berlin");
  near(t.sunrise, "Europe/Berlin", "04:43");
  near(t.sunset, "Europe/Berlin", "21:33");
  assert.ok(t.sunriseBearing > 40 && t.sunriseBearing < 55, "Aufgang im Nordosten");
  assert.ok(t.sunsetBearing > 305 && t.sunsetBearing < 320, "Untergang im Nordwesten");
});

test("Lissabon wird in Lissabonner Ortszeit angezeigt", () => {
  const t = A.sunTimes(38.72, -9.14, "2026-06-21", "Europe/Lisbon");
  near(t.sunrise, "Europe/Lisbon", "06:12");
  near(t.sunset, "Europe/Lisbon", "21:05");
});

test("Goldene und blaue Stunde schließen lückenlos aneinander an", () => {
  const t = A.sunTimes(50.96, 14.07, "2026-10-15", "Europe/Berlin");
  assert.equal(t.blueMorning[1].getTime(), t.goldMorning[0].getTime());
  assert.equal(t.goldEvening[1].getTime(), t.blueEvening[0].getTime());
  assert.ok(t.goldMorning[0] < t.sunrise && t.sunrise < t.goldMorning[1]);
  assert.ok(t.goldEvening[0] < t.sunset && t.sunset < t.goldEvening[1]);
  // Farbbalken und Kacheln verwenden dieselben Grenzen
  assert.equal(A.phase(A.sunPos(new Date(t.sunset.getTime() + 60000), 50.96, 14.07).alt), "gold");
});

test("Tagesprofil hat 288 Werte und beginnt nachts", () => {
  const p = A.dayProfile(52.52, 13.405, "2026-06-21", "Europe/Berlin");
  assert.equal(p.length, 288);
  assert.equal(A.phase(p[0]), "night");
  assert.equal(A.phase(p[144]), "day");
});

test("Milchstraße: im Juli sichtbar, im Dezember nicht", () => {
  const sommer = A.nightInfo(46.62, 12.30, "2026-07-15", "Europe/Rome");
  assert.ok(sommer.win, "Fenster im Juli");
  assert.ok(sommer.best.alt > 10 && sommer.best.b > 150 && sommer.best.b < 220, "hoch im Süden");
  const winter = A.nightInfo(46.62, 12.30, "2026-12-15", "Europe/Rome");
  assert.equal(winter.win, null);
  assert.ok(winter.dark);
});

test("Im Hochsommer in Hamburg wird es nicht astronomisch dunkel", () => {
  const n = A.nightInfo(53.55, 9.99, "2026-06-21", "Europe/Berlin");
  assert.equal(n.dark, false);
});

test("Himmelsrichtungen", () => {
  assert.equal(A.compass(0), "N");
  assert.equal(A.compass(359), "N");
  assert.equal(A.compass(135), "SO");
  assert.equal(A.fmtBearing(258.4), "258° WSW");
});
