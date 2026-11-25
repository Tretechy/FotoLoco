// FotoLoco – Oberfläche und Karte
import * as A from "./astro.js";
import { CATS, BEST, CHANGING, CROWD, RISK, DRONE, YT, cleanSpot, createStore, newId } from "./store.js";
import { drawPin } from "./pins.js";

/* ---------- Hilfsfunktionen ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const isDesktop = () => matchMedia("(min-width:900px)").matches;
const fmtNum = (n, d = 1) => n.toFixed(d).replace(".", ",");
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

let toastTimer;
function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 3500);
}
function banner(msg){ const b = $("#banner"); b.textContent = msg || ""; b.hidden = !msg; }

/* ---------- Zustand ---------- */
const store = createStore();
const S = {
  spots: [], filter: new Set(), sel: null, shared: null,
  mode: "browse", tab: "licht", draft: null, dirty: false, pick: false,
  date: null, min: null, sat: false, snap: "peek", me: null
};
const getSpot = id => S.spots.find(s => s.id === id) || (S.shared && S.shared.id === id ? S.shared : null);
const visibleSpots = () => S.spots.filter(s => !S.filter.size || S.filter.has(s.cat));
try { S.sat = localStorage.getItem("fotoloco-sat") === "1"; } catch {}

/* ---------- Info-Karte (Bottom Sheet) ---------- */
const sheet = $("#sheet"), panel = $("#panel");
function snapHeights(){
  const h = window.innerHeight;
  return {peek: 148, half: Math.round(h * 0.52), full: Math.round(h - 120)};
}
// Freier Kartenbereich neben bzw. über der Info-Karte, damit Spots dort mittig erscheinen.
function mapPadding(){
  const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sheet-h")) || 0;
  return isDesktop() ? {left: 424, top: 110, right: 0, bottom: 0} : {bottom: Math.min(px, window.innerHeight * 0.6), top: 110, left: 0, right: 0};
}
function setSheet(px, animate = true){
  sheet.classList.toggle("dragging", !animate);
  document.documentElement.style.setProperty("--sheet-h", px + "px");
  // setPadding würde eine laufende Kamerafahrt abbrechen
  if (map && !map.isMoving()) syncPadding();
}
function snapTo(name){
  S.snap = name;
  if (isDesktop()){ setSheet(0); return; }
  setSheet(snapHeights()[name]);
}
(function initDrag(){
  const handle = $("#handle");
  let startY = null, startH = 0, moved = false;
  handle.addEventListener("pointerdown", e => { startY = e.clientY; startH = sheet.getBoundingClientRect().height; moved = false; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener("pointermove", e => {
    if (startY === null) return;
    const dy = startY - e.clientY;
    if (Math.abs(dy) > 4) moved = true;
    if (moved){ const sh = snapHeights(); setSheet(Math.max(sh.peek - 40, Math.min(sh.full, startH + dy)), false); }
  });
  handle.addEventListener("pointerup", () => {
    if (startY === null) return;
    startY = null;
    if (!moved){ snapTo(S.snap === "peek" ? "half" : S.snap === "half" ? "full" : "half"); return; }
    const h = sheet.getBoundingClientRect().height, sh = snapHeights();
    const best = Object.entries(sh).sort((a, b) => Math.abs(a[1] - h) - Math.abs(b[1] - h))[0][0];
    snapTo(best);
  });
  window.addEventListener("resize", debounce(() => snapTo(S.snap), 150));
})();

/* ---------- Karte ---------- */
const SAT_ATTR = 'Satellitenbild: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP und die GIS User Community';
let map = null;
try {
  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [10.5, 50.5], zoom: 5.2, maxZoom: 19, attributionControl: false, dragRotate: false, pitchWithRotate: false
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.AttributionControl({compact: true, customAttribution: '<a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a>'}), "bottom-right");
  map.addControl(new maplibregl.NavigationControl({showCompass: false}), "top-right");
} catch (e) {
  banner("Die Karte kann auf diesem Gerät nicht angezeigt werden (WebGL fehlt). Licht-Planer und Spots funktionieren trotzdem.");
}
setTimeout(() => { if (map && !map.isStyleLoaded()) banner("Die Karte lädt nicht. Prüf bitte deine Internetverbindung."); }, 12000);

async function addPinImages(){
  const ratio = 2;
  for (const cat of Object.keys(CATS)) for (const priv of [false, true]){
    const img = drawPin(cat, priv, tok("--cat-" + cat), ratio);
    const name = "pin-" + cat + (priv ? "-p" : "");
    if (!map.hasImage(name)) map.addImage(name, img, {pixelRatio: ratio});
  }
}
function firstSymbolLayer(){ return map.getStyle().layers.find(l => l.type === "symbol")?.id; }

map?.on("load", async () => {
  banner("");
  await addPinImages();
  const before = firstSymbolLayer();
  map.addSource("sat", {type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19, attribution: SAT_ATTR});
  map.addLayer({id: "sat", type: "raster", source: "sat", layout: {visibility: S.sat ? "visible" : "none"}}, before);
  map.addSource("sun", {type: "geojson", data: emptyFC()});
  const lineBase = {type: "line", source: "sun", layout: {"line-cap": "round"}, paint: {"line-color": ["get", "color"], "line-width": ["get", "w"]}};
  map.addLayer({...lineBase, id: "sun-solid", filter: ["==", ["get", "kind"], "solid"]});
  map.addLayer({...lineBase, id: "sun-dash", filter: ["==", ["get", "kind"], "dash"], layout: {"line-cap": "butt"}, paint: {...lineBase.paint, "line-dasharray": [2, 1.5]}});
  map.addLayer({...lineBase, id: "sun-dot", filter: ["==", ["get", "kind"], "dot"], paint: {...lineBase.paint, "line-dasharray": [0.1, 2]}});
  map.addSource("spots", {type: "geojson", data: emptyFC(), cluster: true, clusterRadius: 44, clusterMaxZoom: 13});
  map.addLayer({id: "clusters", type: "circle", source: "spots", filter: ["has", "point_count"], paint: {
    "circle-color": tok("--accent"), "circle-opacity": .92, "circle-stroke-color": "#fff", "circle-stroke-width": 2,
    "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26]}});
  map.addLayer({id: "cluster-count", type: "symbol", source: "spots", filter: ["has", "point_count"], layout: {
    "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-allow-overlap": true},
    paint: {"text-color": "#fff"}});
  map.addLayer({id: "pins", type: "symbol", source: "spots", filter: ["!", ["has", "point_count"]], layout: {
    "icon-image": ["get", "icon"], "icon-anchor": "bottom", "icon-allow-overlap": true, "icon-ignore-placement": true,
    "icon-size": ["case", ["get", "sel"], 1.3, 1], "symbol-sort-key": ["case", ["get", "sel"], 2, 1]}});
  map.on("mouseenter", "pins", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "pins", () => map.getCanvas().style.cursor = S.pick ? "crosshair" : "");
  map.on("mouseenter", "clusters", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "clusters", () => map.getCanvas().style.cursor = S.pick ? "crosshair" : "");
  drawSpots(); drawSun();
  if (S.sel){ const s = getSpot(S.sel); s && map.jumpTo({center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 12)}); }
});
map?.on("error", e => { if (e?.sourceId === "sat") toast("Satellitenbild gerade nicht erreichbar."); });
map?.on("moveend", () => { drawSun(); if (S.mode === "browse") renderBrowseList(); });
function syncPadding(){
  if (!map) return;
  const want = mapPadding(), cur = map.getPadding();
  if (["top", "bottom", "left", "right"].some(k => Math.abs((cur[k] || 0) - want[k]) > 1)) map.setPadding(want);
}
map?.on("moveend", syncPadding);
map?.on("click", e => {
  if (S.pick){ placePick(e.lngLat); return; }
  const f = map.queryRenderedFeatures(e.point, {layers: ["pins", "clusters"]})[0];
  if (!f) return;
  if (f.layer.id === "clusters"){
    map.getSource("spots").getClusterExpansionZoom(f.properties.cluster_id).then(z => map.easeTo({center: f.geometry.coordinates, zoom: z + 0.5}));
  } else selectSpot(f.properties.id);
});

function emptyFC(){ return {type: "FeatureCollection", features: []}; }
function drawSpots(){
  if (!map?.getSource("spots")) return;
  const list = visibleSpots();
  if (S.shared && !S.spots.some(s => s.id === S.shared.id)) list.push(S.shared);
  map.getSource("spots").setData({type: "FeatureCollection", features: list.map(s => ({
    type: "Feature", geometry: {type: "Point", coordinates: [s.lng, s.lat]},
    properties: {id: s.id, icon: "pin-" + s.cat + (s.priv ? "-p" : ""), sel: s.id === S.sel}
  }))});
}
function drawSun(){
  const src = map?.getSource("sun"); if (!src) return;
  const s = getSpot(S.sel);
  if (!s || S.mode !== "spot" || !S.date || S.min == null){ src.setData(emptyFC()); return; }
  const tz = A.tzFor(s.lat, s.lng), t = A.sunTimes(s.lat, s.lng, S.date, tz);
  const b = map.getBounds(), diag = A.distanceKm({lat: b.getSouth(), lng: b.getWest()}, {lat: b.getNorth(), lng: b.getEast()}) * 1000;
  const len = Math.max(150, diag * 0.3);
  const feats = [];
  const line = (bearing, color, kind, w, k = 1) => feats.push({type: "Feature", properties: {color, kind, w},
    geometry: {type: "LineString", coordinates: [[s.lng, s.lat], A.destination(s.lat, s.lng, bearing, len * k)]}});
  if (t.sunriseBearing != null) line(t.sunriseBearing, tok("--gold"), "solid", 5);
  if (t.sunsetBearing != null) line(t.sunsetBearing, tok("--sunset"), "solid", 5);
  const now = A.zonedTime(S.date, S.min, tz), sun = A.sunPos(now, s.lat, s.lng), core = A.corePos(now, s.lat, s.lng);
  line(sun.b, tok("--accent"), sun.alt < 0 ? "dot" : "solid", 3, 0.75);
  if (core.alt > 0) line(core.b, tok("--core"), "dash", 3, 0.85);
  src.setData({type: "FeatureCollection", features: feats});
}
function setSat(on){
  S.sat = on;
  try { localStorage.setItem("fotoloco-sat", on ? "1" : "0"); } catch {}
  $("#layerBtn").setAttribute("aria-pressed", on);
  $("#layerLbl").textContent = on ? "Karte" : "Satellit";
  if (map?.getLayer("sat")) map.setLayoutProperty("sat", "visibility", on ? "visible" : "none");
}
$("#layerBtn").onclick = () => setSat(!S.sat);
setSat(S.sat);

/* ---------- Standort ---------- */
let meMarker = null;
$("#locBtn").onclick = () => {
  if (!navigator.geolocation){ toast("Dein Browser kann den Standort nicht bestimmen."); return; }
  toast("Suche deinen Standort …");
  navigator.geolocation.getCurrentPosition(p => {
    S.me = {lat: p.coords.latitude, lng: p.coords.longitude};
    $("#toast").hidden = true;
    if (!map) return;
    if (!meMarker){ const el = document.createElement("div"); el.className = "me"; meMarker = new maplibregl.Marker({element: el}); }
    meMarker.setLngLat([S.me.lng, S.me.lat]).addTo(map);
    map.flyTo({center: [S.me.lng, S.me.lat], zoom: Math.max(map.getZoom(), 14)});
  }, err => {
    toast(err.code === 1 ? "Standort ist nicht erlaubt. Du kannst ihn in den Einstellungen deines Browsers freigeben." : "Standort konnte gerade nicht bestimmt werden.");
  }, {enableHighAccuracy: true, timeout: 15000, maximumAge: 60000});
};

/* ---------- Ansichten ---------- */
function confirmDiscard(){
  if (S.mode === "form" && S.dirty) return confirm("Deine Eingaben für diesen Spot sind noch nicht gespeichert. Verwerfen?");
  return true;
}
function render(){
  if (S.mode === "spot" && getSpot(S.sel)) return renderSpot(getSpot(S.sel));
  if (S.mode === "form" && S.draft) return renderForm();
  S.mode = "browse"; renderBrowse();
}
function catBadge(cat){ return `<span class="badge" style="--c:var(--cat-${cat})"><span class="dot"></span>${esc(CATS[cat])}</span>`; }
const pinThumb = {};
function pinMini(s){
  const key = s.cat + (s.priv ? "-p" : "");
  if (!pinThumb[key]){ const c = drawPin(s.cat, s.priv, tok("--cat-" + s.cat), 2, true); pinThumb[key] = c.toDataURL(); }
  return `<span class="pinmini" style="--c:var(--cat-${s.cat})"><img src="${pinThumb[key]}" alt=""></span>`;
}
function fmtKm(km){ return km < 1 ? Math.round(km * 1000) + " m" : km < 10 ? fmtNum(km) + " km" : Math.round(km) + " km"; }

function renderBrowse(){
  panel.innerHTML = `
  <section class="sec">
    <div class="spread"><h2 id="browseTitle">Spots hier</h2></div>
    <div class="list" id="browseList"></div>
  </section>
  <section class="sec">
    <details>
      <summary><b>So funktioniert FotoLoco</b></summary>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
        <p>Tipp auf einen Spot. Du siehst, wann und aus welcher Richtung die Sonne auf- und untergeht, wann goldene und blaue Stunde sind, wie das Wetter wird und wann die Milchstraße zu sehen ist.</p>
        <p>Mit <b>+ Spot</b> trägst du eigene Orte ein: öffentlich oder privat.</p>
        <div class="legend">
          <span style="--c:var(--gold)"><i></i>Sonnenaufgang</span><span style="--c:var(--sunset)"><i></i>Sonnenuntergang</span>
          <span style="--c:var(--accent)"><i></i>Sonne zur gewählten Zeit</span><span style="--c:var(--core)"><i class="dash"></i>Milchstraße</span>
        </div>
      </div>
    </details>
    <div class="note">Testversion: Deine Spots werden nur in diesem Browser gespeichert. Mach ab und zu eine Sicherung.</div>
    <div class="foot">
      <button type="button" id="exportBtn">Sicherung herunterladen</button>
      <button type="button" id="importBtn">Sicherung laden</button>
      <input type="file" id="importIn" accept="application/json,.json" hidden>
      <a href="impressum.html">Impressum</a><a href="datenschutz.html">Datenschutz</a>
    </div>
  </section>`;
  renderBrowseList();
  $("#exportBtn").onclick = exportBackup;
  $("#importBtn").onclick = () => $("#importIn").click();
  $("#importIn").onchange = e => importBackup(e.target.files[0]);
}
function renderBrowseList(){
  const box = $("#browseList"); if (!box) return;
  const center = map ? map.getCenter() : {lat: 50.5, lng: 10.5};
  const b = map?.getBounds();
  let list = visibleSpots();
  if (b) list = list.filter(s => b.contains([s.lng, s.lat]));
  list = list.map(s => ({s, d: A.distanceKm({lat: center.lat, lng: center.lng}, s)})).sort((x, y) => x.d - y.d);
  const ref = S.me || null;
  $("#browseTitle").textContent = list.length ? `${list.length} ${list.length === 1 ? "Spot" : "Spots"} in diesem Ausschnitt` : "Spots hier";
  if (!list.length){
    box.innerHTML = `<p class="muted">${S.spots.length ? "In diesem Kartenausschnitt gibt es noch keine Spots" + (S.filter.size ? " in den gewählten Kategorien" : "") + ". Zoom heraus oder trag selbst einen ein." : "Noch keine Spots. Trag deinen ersten Lieblingsort ein, zum Beispiel ein Parkdeck mit Blick über die Stadt."}</p>`;
    return;
  }
  box.innerHTML = list.slice(0, 60).map(({s, d}) => `<button type="button" data-id="${esc(s.id)}">${pinMini(s)}<span class="t"><b>${esc(s.name)}</b><small>${esc(CATS[s.cat])}${s.priv ? " · privat" : ""}</small></span><span class="d">${ref ? fmtKm(A.distanceKm(ref, s)) : ""}</span></button>`).join("");
  box.querySelectorAll("button").forEach(btn => btn.onclick = () => selectSpot(btn.dataset.id, true));
}

/* ---------- Spot-Ansicht ---------- */
function lvl(n, max, c){ let h = `<span class="lvl" style="--c:${c}">`; for (let i = 1; i <= max; i++) h += `<b class="${i <= n ? "on" : ""}"></b>`; return h + "</span>"; }
const riskColor = r => r === "hoch" ? "var(--bad)" : r === "mittel" ? "var(--warn)" : "var(--ok)";

function renderSpot(s){
  const tz = A.tzFor(s.lat, s.lng);
  if (!S.date) S.date = A.dateInTz(new Date(), tz);
  if (S.min == null){ const t = A.sunTimes(s.lat, s.lng, S.date, tz).sunset; S.min = t instanceof Date && !isNaN(t) ? A.minutesOfDay(t, tz) : 20 * 60; }
  const mini = [];
  if (s.bestTimes.length) mini.push(`<span class="badge">☀ ${esc(s.bestTimes.slice(0, 2).join(", "))}</span>`);
  if (s.crowd) mini.push(`<span class="badge">👥 ${esc(CROWD[s.crowd])}</span>`);
  if (s.risk) mini.push(`<span class="badge" style="--c:${riskColor(s.risk)}"><span class="dot"></span>Risiko ${esc(RISK[s.risk].toLowerCase())}</span>`);
  if (s.drone) mini.push(`<span class="badge">Drohne: ${esc(DRONE[s.drone].split(" ")[0])}</span>`);
  const own = !s.shared;
  panel.innerHTML = `
  <section class="sec">
    <div class="spread">
      <div class="row">${catBadge(s.cat)}${s.priv ? '<span class="badge">🔒 Privat</span>' : ""}${s.example ? '<span class="badge" title="Startdaten mit wenigen Angaben">Beispiel</span>' : ""}${s.shared ? '<span class="badge">Geteilt</span>' : ""}</div>
      <button class="close" id="close" type="button" aria-label="Schließen">✕</button>
    </div>
    <h2>${esc(s.name)}</h2>
    ${mini.length ? `<div class="facts-mini">${mini.join("")}</div>` : `<p class="muted small">Noch wenige Angaben${own ? " – ergänze sie über „Bearbeiten“." : "."}</p>`}
    <div class="row">
      <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}">Route</a>
      <button class="btn" id="shareBtn" type="button">Teilen</button>
      ${own ? '<button class="btn" id="editBtn" type="button">Bearbeiten</button>' : '<button class="btn primary" id="adoptBtn" type="button">In meine Spots übernehmen</button>'}
    </div>
  </section>
  <nav class="tabs" role="tablist">
    ${[["licht", "Licht"], ["ort", "Vor Ort"], ["medien", "Medien"], ["community", "Community"]].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${l}</button>`).join("")}
  </nav>
  <div id="tabBody"></div>`;
  $("#close").onclick = closeSpot;
  $("#shareBtn").onclick = () => shareSpot(s);
  $("#editBtn") && ($("#editBtn").onclick = () => openForm(s));
  $("#adoptBtn") && ($("#adoptBtn").onclick = () => adoptShared(s));
  panel.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { S.tab = b.dataset.tab; renderSpot(s); });
  const body = $("#tabBody");
  if (S.tab === "licht") renderLight(s, tz, body);
  else if (S.tab === "ort") renderPlace(s, body);
  else if (S.tab === "medien") renderMedia(s, body);
  else renderCommunity(body);
}

function renderLight(s, tz, body){
  const t = A.sunTimes(s.lat, s.lng, S.date, tz);
  const n = A.nightInfo(s.lat, s.lng, S.date, tz);
  const f = d => A.fmtTime(d, tz);
  const range = r => f(r[0]) + "–" + f(r[1]);
  const today = A.dateInTz(new Date(), tz);
  const quick = [["Heute", today], ["Morgen", A.addDays(today, 1)]];
  const wd = new Date(today + "T12:00:00Z").getUTCDay();
  const sat = A.addDays(today, ((6 - wd + 7) % 7) || 7), sun = A.addDays(today, ((7 - wd) % 7) || 7);
  quick.push(["Samstag", sat], ["Sonntag", sun]);
  const devOff = -new Date().getTimezoneOffset(), spotOff = A.tzOffset(new Date(), tz), diff = (spotOff - devOff) / 60;
  const tzNote = diff ? ` · ${fmtNum(Math.abs(diff), Number.isInteger(diff) ? 0 : 1)} Std. ${diff > 0 ? "später" : "früher"} als bei dir` : "";
  const offH = spotOff / 60;
  let mw;
  if (!n.dark) mw = "In dieser Nacht wird es nicht richtig dunkel. Die Milchstraße ist kaum zu sehen.";
  else if (!n.win) mw = "Das Zentrum der Milchstraße steht in dieser Nacht nicht über dem Horizont, solange es dunkel ist. In Mitteleuropa ist es etwa von März bis September zu sehen.";
  else mw = `Sichtbar von <b class="mono">${f(n.win.from)}</b> bis <b class="mono">${f(n.win.to)}</b>. Am höchsten um <b class="mono">${f(n.best.t)}</b>: ${Math.round(n.best.alt)}° über dem Horizont in Richtung <b class="mono">${A.fmtBearing(n.best.b)}</b>.`;
  const moonTxt = `Mond ${Math.round(n.moonFrac * 100)} % beleuchtet · Aufgang ${f(n.moonRise)} · Untergang ${f(n.moonSet)}` +
    (n.win ? (n.moonDisturbs ? ". <b>Der helle Mond stört</b> im Milchstraßen-Fenster." : ". Der Mond stört kaum.") : "");
  body.innerHTML = `
  <section class="sec">
    <div class="dates" role="group" aria-label="Datum wählen">
      ${quick.map(([l, d]) => `<button type="button" class="chip" data-d="${d}" aria-pressed="${S.date === d}">${l}</button>`).join("")}
      <input type="date" id="date" value="${S.date}" aria-label="Datum vor Ort">
    </div>
    <p class="tzline">Ortszeit am Spot (UTC${offH >= 0 ? "+" : "−"}${fmtNum(Math.abs(offH), Number.isInteger(offH) ? 0 : 1)})${tzNote}</p>
    <div class="times">
      <div class="tcard" style="--c:var(--blue)"><span class="k"><i></i>Blaue Stunde morgens</span><span class="v">${range(t.blueMorning)}</span></div>
      <div class="tcard" style="--c:var(--gold)"><span class="k"><i></i>Sonnenaufgang</span><span class="v">${f(t.sunrise)}</span><span class="s">${A.fmtBearing(t.sunriseBearing)}</span></div>
      <div class="tcard" style="--c:var(--gold)"><span class="k"><i></i>Goldene Stunde morgens</span><span class="v">${range(t.goldMorning)}</span></div>
      <div class="tcard" style="--c:var(--gold)"><span class="k"><i></i>Goldene Stunde abends</span><span class="v">${range(t.goldEvening)}</span></div>
      <div class="tcard" style="--c:var(--sunset)"><span class="k"><i></i>Sonnenuntergang</span><span class="v">${f(t.sunset)}</span><span class="s">${A.fmtBearing(t.sunsetBearing)}</span></div>
      <div class="tcard" style="--c:var(--blue)"><span class="k"><i></i>Blaue Stunde abends</span><span class="v">${range(t.blueEvening)}</span></div>
    </div>
  </section>
  <section class="sec">
    <h3>Uhrzeit wählen</h3>
    <div class="strip-wrap">
      <canvas class="strip" id="strip" width="576" height="68" aria-label="Lichtverlauf über den Tag. Tippen oder ziehen, um eine Uhrzeit zu wählen."></canvas>
      <div class="ticks"><span>0</span><span>6</span><span>12</span><span>18</span><span>24 Uhr</span></div>
      <input type="range" id="time" min="0" max="1435" step="5" value="${S.min}" aria-label="Uhrzeit">
    </div>
    <dl class="readout" id="readout"></dl>
    <div class="legend">
      <span style="--c:var(--gold)"><i></i>Aufgang</span><span style="--c:var(--sunset)"><i></i>Untergang</span>
      <span style="--c:var(--accent)"><i></i>Sonne gewählt</span><span style="--c:var(--core)"><i class="dash"></i>Milchstraße</span>
    </div>
  </section>
  <section class="sec">
    <h3>Wetter</h3>
    <div id="wx"><p class="muted small">Lade Vorhersage …</p></div>
  </section>
  <section class="sec">
    <h3>Milchstraße in dieser Nacht</h3>
    <p>${mw}</p>
    <p class="muted small">${moonTxt}</p>
  </section>`;
  body.querySelectorAll(".dates .chip").forEach(b => b.onclick = () => setDate(b.dataset.d));
  $("#date").onchange = e => e.target.value && setDate(e.target.value);
  $("#time").oninput = e => { S.min = +e.target.value; updateReadout(s, tz); drawSun(); };
  const strip = $("#strip");
  const fromPointer = e => {
    const r = strip.getBoundingClientRect();
    S.min = Math.max(0, Math.min(1435, Math.round(((e.clientX - r.left) / r.width) * 1440 / 5) * 5));
    $("#time").value = S.min; updateReadout(s, tz); drawSun();
  };
  let down = false;
  strip.addEventListener("pointerdown", e => { down = true; strip.setPointerCapture(e.pointerId); fromPointer(e); });
  strip.addEventListener("pointermove", e => down && fromPointer(e));
  strip.addEventListener("pointerup", () => down = false);
  S.profile = A.dayProfile(s.lat, s.lng, S.date, tz);
  updateReadout(s, tz);
  loadWeather(s, tz, t);
}
function setDate(d){
  S.date = d; S.wx = null;
  render(); drawSun();
}
function updateReadout(s, tz){
  const now = A.zonedTime(S.date, S.min, tz), sun = A.sunPos(now, s.lat, s.lng), core = A.corePos(now, s.lat, s.lng);
  const shadow = sun.alt > 1 ? fmtNum(1 / Math.tan(sun.alt * Math.PI / 180)) + " × Objekthöhe" : "—";
  const r = $("#readout");
  if (r) r.innerHTML = `<dt>Uhrzeit</dt><dd><b>${A.fmtTime(now, tz)}</b> · ${A.PHASE_LABEL[A.phase(sun.alt)]}</dd>
    <dt>Sonne</dt><dd>${fmtNum(sun.alt)}° hoch, Richtung ${A.fmtBearing(sun.b)}</dd>
    <dt>Schatten</dt><dd>${shadow}</dd>
    <dt>Milchstraße</dt><dd>${core.alt > 0 ? Math.round(core.alt) + "° hoch, Richtung " + A.fmtBearing(core.b) : "unter dem Horizont"}</dd>`;
  drawStrip();
  updateWeatherNow(s, tz);
}
function drawStrip(){
  const c = $("#strip"); if (!c || !S.profile) return;
  const g = c.getContext("2d"), W = c.width, H = c.height;
  const cols = {night: tok("--night"), blue: tok("--blue"), gold: tok("--gold"), day: tok("--day")};
  S.profile.forEach((alt, i) => { g.fillStyle = cols[A.phase(alt)]; g.fillRect(Math.floor(i * W / 288), 0, Math.ceil(W / 288) + 1, H); });
  const x = S.min / 1440 * W;
  g.fillStyle = "#fff"; g.fillRect(x - 3, 0, 6, H);
  g.fillStyle = tok("--fg"); g.fillRect(x - 1.5, 0, 3, H);
}

/* ---------- Wetter (Open-Meteo, kostenlos für nicht-kommerzielle Nutzung) ---------- */
const wxCache = new Map();
async function fetchWeather(s){
  const key = s.lat.toFixed(2) + "," + s.lng.toFixed(2) + "," + S.date;
  if (wxCache.has(key)) return wxCache.get(key);
  const p = (async () => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${s.lat.toFixed(3)}&longitude=${s.lng.toFixed(3)}&hourly=cloud_cover,cloud_cover_low,cloud_cover_high,precipitation_probability&timezone=GMT&start_date=${A.addDays(S.date, -1)}&end_date=${A.addDays(S.date, 1)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("wx");
    const j = await r.json();
    return {t: j.hourly.time.map(x => Date.parse(x + ":00Z")), h: j.hourly};
  })();
  wxCache.set(key, p);
  p.catch(() => wxCache.delete(key));
  return p;
}
function wxAt(w, date){
  if (!(date instanceof Date) || isNaN(date)) return null;
  let best = -1, bd = Infinity;
  w.t.forEach((t, i) => { const d = Math.abs(t - date.getTime()); if (d < bd){ bd = d; best = i; } });
  if (best < 0 || bd > 90 * 60000) return null;
  const v = k => w.h[k]?.[best];
  return {all: v("cloud_cover"), low: v("cloud_cover_low"), high: v("cloud_cover_high"), rain: v("precipitation_probability")};
}
function wxCard(label, x){
  if (!x || x.all == null) return `<div class="tcard"><span class="k">${label}</span><span class="v">—</span></div>`;
  return `<div class="tcard"><span class="k">${label}</span><span class="v">☁ ${Math.round(x.all)} %</span><span class="s">tief ${Math.round(x.low ?? 0)} · hoch ${Math.round(x.high ?? 0)}${x.rain != null ? " · 🌧 " + Math.round(x.rain) + " %" : ""}</span></div>`;
}
function wxHint(x){
  if (!x || x.all == null) return "";
  if (x.low > 70) return "Viele tiefe Wolken: Die Sonne ist wahrscheinlich verdeckt.";
  if (x.high >= 25 && x.high <= 80 && x.low < 40) return "Hohe Wolken bei freiem Horizont: gute Chancen auf einen farbigen Himmel.";
  if (x.all < 15) return "Fast wolkenlos: klares Licht, aber wenig Farbe am Himmel.";
  return "";
}
async function loadWeather(s, tz, t){
  const box = $("#wx"); if (!box) return;
  const today = A.dateInTz(new Date(), tz);
  const days = (Date.parse(S.date) - Date.parse(today)) / 864e5;
  if (days < 0 || days > 14){ box.innerHTML = `<p class="muted small">Eine Wettervorhersage gibt es nur für die nächsten zwei Wochen.</p>`; return; }
  const forDate = S.date, forId = s.id;
  try {
    const w = await fetchWeather(s);
    if (S.date !== forDate || S.sel !== forId || !$("#wx")) return;
    S.wx = w;
    const sr = wxAt(w, t.sunrise), ss = wxAt(w, t.sunset);
    $("#wx").innerHTML = `<div class="wx">${wxCard("Sonnenaufgang", sr)}<div id="wxNow"></div>${wxCard("Sonnenuntergang", ss)}</div>
      <p class="small" id="wxHint">${esc(wxHint(ss) || wxHint(sr))}</p>
      <p class="muted small">Vorhersage: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)</p>`;
    updateWeatherNow(s, tz);
  } catch {
    if ($("#wx")) $("#wx").innerHTML = `<p class="muted small">Die Wettervorhersage ist gerade nicht erreichbar.</p>`;
  }
}
function updateWeatherNow(s, tz){
  const box = $("#wxNow"); if (!box || !S.wx) return;
  box.outerHTML = `<div id="wxNow">${wxCard(A.fmtTime(A.zonedTime(S.date, S.min, tz), tz) + " Uhr", wxAt(S.wx, A.zonedTime(S.date, S.min, tz)))}</div>`;
  const n = $("#wxNow"); n.style.display = "contents";
}

function renderPlace(s, body){
  const na = '<span class="muted">Noch keine Angabe</span>';
  body.innerHTML = `
  <section class="sec">
    ${s.desc ? `<p style="white-space:pre-line">${esc(s.desc)}</p>` : ""}
    <dl class="facts">
      <dt>Beste Zeit</dt><dd>${s.bestTimes.length ? esc(s.bestTimes.join(", ")) : na}</dd>
      <dt>Anfahrt & Parken</dt><dd>${s.parking ? esc(s.parking) : na}</dd>
      <dt>Umziehen</dt><dd>${s.changing ? esc(CHANGING[s.changing]) : na}</dd>
      <dt>Andrang</dt><dd>${s.crowd ? lvl(s.crowd, 5, "var(--warn)") + esc(CROWD[s.crowd]) : na}</dd>
      <dt>Risiko</dt><dd>${s.risk ? lvl({niedrig: 1, mittel: 2, hoch: 3}[s.risk], 3, riskColor(s.risk)) + esc(RISK[s.risk]) : na}</dd>
      <dt>Rechtliches</dt><dd>${s.legal ? esc(s.legal) : na}</dd>
      <dt>Drohne</dt><dd>${s.drone ? esc(DRONE[s.drone]) : na}</dd>
      <dt>Koordinaten</dt><dd class="mono">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</dd>
    </dl>
    <p class="muted small">Angaben stammen von Nutzern und sind keine Rechtsberatung. Drohnenzonen bitte immer in der offiziellen Karte prüfen, in Deutschland unter <a href="https://www.dipul.de" target="_blank" rel="noopener">dipul.de</a>.</p>
  </section>`;
}
function renderMedia(s, body){
  body.innerHTML = `
  <section class="sec">
    <h3>Fotos</h3>
    <div class="note">Fotos hochladen kommt mit der gemeinsamen Datenbank.</div>
  </section>
  <section class="sec">
    <h3>Videos</h3>
    ${s.videos.length ? '<ul class="links">' + s.videos.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">▶ ${esc(u.replace(/^https:\/\/(www\.)?/, ""))}</a></li>`).join("") + "</ul>" : '<p class="muted">Noch keine Videos.</p>'}
    ${s.shared ? "" : `<div class="row"><input type="url" id="ytIn" placeholder="YouTube-Link einfügen" style="flex:1;min-width:0"><button class="btn" id="ytAdd" type="button">Hinzufügen</button></div><p class="muted small" id="ytMsg" hidden></p>`}
  </section>`;
  $("#ytAdd") && ($("#ytAdd").onclick = () => {
    const u = $("#ytIn").value.trim();
    if (!YT.test(u)){ const m = $("#ytMsg"); m.hidden = false; m.textContent = "Bitte einen Link von youtube.com oder youtu.be einfügen (beginnt mit https://)."; return; }
    try { store.put({...s, videos: [...s.videos, u], updatedAt: Date.now()}); toast("Video hinzugefügt."); }
    catch (e) { toast(e.message); }
  });
}
function renderCommunity(body){
  body.innerHTML = `
  <section class="sec">
    <div class="note">Bewertungen und Kommentare kommen mit der gemeinsamen Datenbank. Dann kannst du Spots nach Motiv, Licht, Ruhe, Erreichbarkeit und Sicherheit bewerten und Tipps mit anderen teilen.</div>
  </section>`;
}

function selectSpot(id, fly){
  if (!confirmDiscard()) return;
  const s = getSpot(id); if (!s) return;
  if (S.sel !== id){ S.min = null; S.wx = null; }
  S.sel = id; S.mode = "spot"; S.dirty = false;
  if (!S.date) S.date = A.dateInTz(new Date(), A.tzFor(s.lat, s.lng));
  if (S.snap === "peek") snapTo("half");
  if (map && (fly || !map.getBounds().contains([s.lng, s.lat]))) map.flyTo({center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 12), duration: 800, padding: mapPadding()});
  history.replaceState(null, "", "#" + shareHash(s));
  drawSpots(); render(); drawSun();
  panel.scrollTop = 0;
}
function closeSpot(){
  S.sel = null; S.mode = "browse";
  history.replaceState(null, "", location.pathname + location.search);
  drawSpots(); drawSun(); render(); snapTo("peek");
}

/* ---------- Teilen ---------- */
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
function shareHash(s){ return "spot=" + b64(JSON.stringify({n: s.name, c: s.cat, a: +s.lat.toFixed(5), o: +s.lng.toFixed(5)})); }
async function shareSpot(s){
  const url = location.origin + location.pathname + "#" + shareHash(s);
  try {
    if (navigator.share){ await navigator.share({title: s.name + " – FotoLoco", text: "Foto-Spot: " + s.name, url}); return; }
    await navigator.clipboard.writeText(url); toast("Link kopiert. Du kannst ihn jetzt z. B. per WhatsApp verschicken.");
  } catch (e) { if (e?.name !== "AbortError") prompt("Link zum Kopieren:", url); }
}
function readHash(){
  const m = location.hash.match(/^#spot=([\w-]+)$/); if (!m) return;
  try {
    const j = JSON.parse(unb64(m[1]));
    const found = S.spots.find(s => Math.abs(s.lat - j.a) < 1e-4 && Math.abs(s.lng - j.o) < 1e-4);
    if (found){ S.sel = found.id; S.mode = "spot"; return; }
    const s = cleanSpot("geteilt", {name: j.n, cat: j.c, lat: j.a, lng: j.o}, false);
    if (s){ s.shared = true; S.shared = s; S.sel = s.id; S.mode = "spot"; }
  } catch {}
}
function adoptShared(s){
  const copy = {...s, id: newId(), priv: true, shared: false, createdAt: Date.now(), updatedAt: Date.now()};
  delete copy.shared;
  try { store.put(copy); S.shared = null; S.sel = copy.id; toast("Als privater Spot gespeichert."); history.replaceState(null, "", "#" + shareHash(copy)); render(); }
  catch (e) { toast(e.message); }
}

/* ---------- Formular ---------- */
function openForm(spot, lngLat){
  if (spot) S.draft = {...spot, bestTimes: [...spot.bestTimes], _new: false};
  else S.draft = {id: newId(), name: "", cat: S.filter.size === 1 ? [...S.filter][0] : "aussicht", lat: lngLat.lat, lng: lngLat.lng, desc: "", bestTimes: [],
    parking: "", changing: "", crowd: 0, risk: "", legal: "", drone: "", videos: [], photos: [], priv: false, _new: true};
  S.mode = "form"; S.dirty = !spot;
  render(); drawSun();
  if (S.snap !== "full") snapTo(isDesktop() ? "half" : "full");
  panel.scrollTop = 0;
}
const CROWD_SHORT = ["–", "leer", "wenig", "mittel", "belebt", "voll"];
function renderForm(){
  const d = S.draft;
  const opts = (obj, cur) => `<option value="">Keine Angabe</option>` + Object.entries(obj).map(([k, v]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${esc(v)}</option>`).join("");
  panel.innerHTML = `
  <section class="sec">
    <div class="spread"><h2>${d._new ? "Neuer Spot" : "Spot bearbeiten"}</h2><button class="btn ghost" id="fCancel" type="button">Abbrechen</button></div>
    <div class="row small"><span class="mono muted">${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}</span><button class="btn" id="fRepick" type="button">Position ändern</button></div>
    <label class="f">Name <span class="req" aria-hidden="true">*</span><input type="text" id="fName" maxlength="120" required value="${esc(d.name)}" placeholder="z. B. Parkdeck Altmarkt, oberste Ebene"></label>
    <label class="f">Kategorie<select id="fCat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${d.cat === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
    <div class="f">Sichtbarkeit
      <div class="seg" role="group" aria-label="Sichtbarkeit"><button type="button" id="vPub" aria-pressed="${!d.priv}">Öffentlich</button><button type="button" id="vPriv" aria-pressed="${d.priv}">🔒 Privat</button></div>
      <small>${d.priv ? "Nur du siehst diesen Spot." : "Später sehen alle Nutzer diesen Spot und können ihn bewerten."}</small>
    </div>
    ${d.cat === "lostplace" && !d.priv ? '<div class="note warn">Lost Places liegen oft auf Privatgelände und werden schnell zerstört, wenn der Ort bekannt wird. Speichere sie besser privat.</div>' : ""}
    <label class="f">Beschreibung<textarea id="fDesc" maxlength="2000" placeholder="Was macht den Ort besonders? Welches Motiv, welche Perspektive?">${esc(d.desc)}</textarea></label>
  </section>
  <section class="sec">
    <h3>Beste Zeit</h3>
    <div class="wrapchips" id="fBest">${BEST.map(b => `<button type="button" class="chip" data-b="${esc(b)}" aria-pressed="${d.bestTimes.includes(b)}">${esc(b)}</button>`).join("")}</div>
  </section>
  <section class="sec">
    <h3>Vor Ort</h3>
    <label class="f">Anfahrt & Parken<textarea id="fPark" maxlength="1500" placeholder="Wo parken, wie lang ist der Fußweg, Kosten, ÖPNV …">${esc(d.parking)}</textarea></label>
    <label class="f">Umziehen für Models<select id="fChg">${opts(CHANGING, d.changing)}</select></label>
    <div class="f">Andrang<div class="seg" id="fCrowd" role="group" aria-label="Andrang">${CROWD_SHORT.map((l, i) => `<button type="button" data-v="${i}" aria-pressed="${d.crowd === i}" title="${esc(CROWD[i])}">${l}</button>`).join("")}</div><small id="fCrowdL">${esc(CROWD[d.crowd])}</small></div>
    <label class="f">Risiko<select id="fRisk">${opts(RISK, d.risk)}</select></label>
    <label class="f">Rechtliches<textarea id="fLegal" maxlength="1500" placeholder="Privatgelände? Genehmigung nötig? Fotografieren erlaubt?">${esc(d.legal)}</textarea></label>
    <label class="f">Drohne<select id="fDrone">${opts(DRONE, d.drone)}</select></label>
  </section>
  <section class="sec">
    <p class="small" id="fMsg" role="alert" hidden></p>
    <div class="row"><button class="btn primary" id="fSave" type="button">Spot speichern</button>
    ${d._new ? "" : '<button class="btn danger" id="fDel" type="button">Löschen</button>'}</div>
  </section>`;
  const keep = () => {
    d.name = $("#fName").value; d.cat = $("#fCat").value; d.desc = $("#fDesc").value; d.parking = $("#fPark").value;
    d.changing = $("#fChg").value; d.risk = $("#fRisk").value; d.legal = $("#fLegal").value; d.drone = $("#fDrone").value;
  };
  panel.querySelectorAll("input,textarea,select").forEach(el => el.addEventListener("input", () => S.dirty = true));
  $("#fCancel").onclick = () => {
    if (!confirmDiscard()) return;
    S.dirty = false; S.draft = null;
    if (!d._new && getSpot(d.id)){ S.mode = "spot"; S.sel = d.id; } else S.mode = "browse";
    render(); drawSun();
  };
  $("#fRepick").onclick = () => { keep(); startPick(); };
  $("#vPub").onclick = () => { keep(); d.priv = false; S.dirty = true; renderForm(); };
  $("#vPriv").onclick = () => { keep(); d.priv = true; S.dirty = true; renderForm(); };
  $("#fCat").onchange = () => { keep(); renderForm(); };
  $("#fCrowd").querySelectorAll("button").forEach(b => b.onclick = () => {
    d.crowd = +b.dataset.v; S.dirty = true;
    $("#fCrowd").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
    $("#fCrowdL").textContent = CROWD[d.crowd];
  });
  $("#fBest").querySelectorAll("button").forEach(b => b.onclick = () => {
    const v = b.dataset.b, i = d.bestTimes.indexOf(v);
    i >= 0 ? d.bestTimes.splice(i, 1) : d.bestTimes.push(v);
    b.setAttribute("aria-pressed", i < 0); S.dirty = true;
  });
  $("#fSave").onclick = () => { keep(); saveDraft(); };
  $("#fDel") && ($("#fDel").onclick = e => {
    if (e.target.dataset.confirm !== "1"){ e.target.dataset.confirm = "1"; e.target.textContent = "Wirklich löschen?"; return; }
    try { store.remove(d.id); S.dirty = false; S.draft = null; S.sel = null; S.mode = "browse"; toast("Spot gelöscht."); history.replaceState(null, "", location.pathname); render(); drawSun(); }
    catch (err) { showFormMsg(err.message); }
  });
}
function showFormMsg(t){ const m = $("#fMsg"); if (m){ m.hidden = false; m.textContent = t; } }
function saveDraft(){
  const d = S.draft;
  if (!d.name.trim()){ showFormMsg("Bitte gib dem Spot einen Namen."); $("#fName").focus(); return; }
  const rec = {...d, name: d.name.trim(), desc: d.desc.trim(), parking: d.parking.trim(), legal: d.legal.trim(),
    lat: +d.lat.toFixed(6), lng: +d.lng.toFixed(6), createdAt: d.createdAt || Date.now(), updatedAt: Date.now(), createdBy: "local"};
  delete rec._new;
  const clean = cleanSpot(rec.id, rec, rec.priv);
  if (!clean){ showFormMsg("Die Position ist ungültig. Bitte setze sie neu."); return; }
  try {
    store.put(clean);
    S.dirty = false; S.draft = null; removePickMarker();
    toast(d._new ? "Spot gespeichert." : "Änderungen gespeichert.");
    S.sel = null; selectSpot(clean.id); snapTo("half");
  } catch (e) { showFormMsg(e.message || "Speichern hat nicht geklappt."); }
}

/* ---------- Spot setzen ---------- */
let pickMarker = null;
function startPick(){
  S.pick = true; $("#pickbar").hidden = false;
  if (map) map.getCanvas().style.cursor = "crosshair";
  if (!isDesktop()) snapTo("peek");
}
function endPick(){ S.pick = false; $("#pickbar").hidden = true; if (map) map.getCanvas().style.cursor = ""; }
function removePickMarker(){ pickMarker?.remove(); pickMarker = null; }
function placePick(ll){
  endPick();
  if (!pickMarker){
    const img = new Image(); img.src = drawPin(S.draft?.cat || "aussicht", false, tok("--accent"), 2, true).toDataURL(); img.width = 32;
    pickMarker = new maplibregl.Marker({element: img, anchor: "bottom", draggable: true});
    pickMarker.on("dragend", () => { if (S.draft){ const p = pickMarker.getLngLat(); S.draft.lat = p.lat; S.draft.lng = p.lng; S.dirty = true; renderForm(); } });
  }
  pickMarker.setLngLat(ll).addTo(map);
  if (S.mode === "form" && S.draft){ S.draft.lat = ll.lat; S.draft.lng = ll.lng; S.dirty = true; renderForm(); snapTo(isDesktop() ? "half" : "full"); }
  else openForm(null, ll);
}
$("#pickCancel").onclick = () => { endPick(); if (S.mode === "form") snapTo("full"); };
$("#addBtn").onclick = () => {
  if (!confirmDiscard()) return;
  S.dirty = false;
  if (!map){ toast("Ohne Karte kann kein Spot gesetzt werden."); return; }
  if (S.mode === "form"){ S.draft = null; S.mode = "browse"; render(); }
  removePickMarker(); startPick();
};

/* ---------- Filter ---------- */
function renderChips(){
  const box = $("#chips");
  box.innerHTML = Object.entries(CATS).map(([k, v]) => `<button type="button" class="chip" data-c="${k}" style="--c:var(--cat-${k})" aria-pressed="${S.filter.has(k)}"><span class="dot"></span>${esc(v)}</button>`).join("");
  box.querySelectorAll("button").forEach(b => b.onclick = () => {
    S.filter.has(b.dataset.c) ? S.filter.delete(b.dataset.c) : S.filter.add(b.dataset.c);
    renderChips(); drawSpots(); if (S.mode === "browse") renderBrowseList();
  });
}

/* ---------- Suche ---------- */
const q = $("#q"), results = $("#results");
let cities = [];
fetch("data/cities.json").then(r => r.json()).then(c => cities = c).catch(() => {});
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
let lastQuery = "", remote = [];
function renderResults(){
  const t = norm(q.value.trim());
  if (t.length < 2){ results.hidden = true; return; }
  const spots = S.spots.filter(s => norm(s.name).includes(t)).slice(0, 4);
  const cs = [];
  for (const c of cities){ if (norm(c[0]).startsWith(t)){ cs.push(c); if (cs.length >= 4) break; } }
  let html = "";
  if (spots.length) html += "<h4>Spots</h4>" + spots.map(s => `<button type="button" data-spot="${esc(s.id)}"><span>${esc(s.name)}</span><small>${esc(CATS[s.cat])}</small></button>`).join("");
  if (cs.length) html += "<h4>Städte</h4>" + cs.map((c, i) => `<button type="button" data-city="${i}"><span>${esc(c[0])}</span><small>Stadt</small></button>`).join("");
  if (remote.length) html += "<h4>Orte & Adressen</h4>" + remote.map((r, i) => `<button type="button" data-r="${i}"><span>${esc(r.label)}</span><small>${esc(r.sub)}</small></button>`).join("");
  if (!html) html = `<div class="empty">${t.length >= 3 ? "Suche …" : "Weiter tippen …"}</div>`;
  results.innerHTML = html; results.hidden = false;
  results.querySelectorAll("[data-spot]").forEach(b => b.onclick = () => { closeSearch(); selectSpot(b.dataset.spot, true); });
  results.querySelectorAll("[data-city]").forEach(b => b.onclick = () => { const c = cs[+b.dataset.city]; closeSearch(); map?.flyTo({center: [c[2], c[1]], zoom: 12}); });
  results.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { const r = remote[+b.dataset.r]; closeSearch(); goTo(r); });
}
function goTo(r){
  if (!map) return;
  if (r.extent) map.fitBounds([[r.extent[0], r.extent[3]], [r.extent[2], r.extent[1]]], {maxZoom: 17, duration: 800});
  else map.flyTo({center: [r.lng, r.lat], zoom: 17});
}
function closeSearch(){ results.hidden = true; q.blur(); }
// Ortssuche über Photon (OpenStreetMap-Daten, komoot). Erst ab 3 Zeichen und mit Pause, um den Dienst zu schonen.
const PLACE_TYPES = {parking: "Parkplatz/Parkhaus", multi_storey: "Parkhaus", viewpoint: "Aussichtspunkt", peak: "Gipfel", city: "Stadt", town: "Stadt", village: "Dorf", street: "Straße", house: "Adresse"};
const searchRemote = debounce(async text => {
  if (text.length < 3) return;
  lastQuery = text;
  try {
    const c = map?.getCenter();
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=6&lang=de${c ? `&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}` : ""}`);
    const j = await r.json();
    if (text !== lastQuery) return;
    remote = (j.features || []).map(f => {
      const p = f.properties || {};
      const label = [p.name, p.street && (p.street + (p.housenumber ? " " + p.housenumber : ""))].filter(Boolean).join(", ") || p.city || "Ort";
      const sub = PLACE_TYPES[p.osm_value] || [p.city, p.country].filter(Boolean).join(", ");
      return {label, sub, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], extent: p.extent};
    });
    renderResults();
  } catch { remote = []; renderResults(); }
}, 400);
q.addEventListener("input", () => { remote = []; renderResults(); searchRemote(q.value.trim()); });
q.addEventListener("focus", () => q.value.trim().length >= 2 && renderResults());
q.addEventListener("keydown", e => {
  if (e.key === "Escape") closeSearch();
  if (e.key === "Enter") results.querySelector("button")?.click();
});
document.addEventListener("pointerdown", e => { if (!e.target.closest(".search")) results.hidden = true; });

/* ---------- Sicherung ---------- */
function exportBackup(){
  const blob = new Blob([store.exportJSON()], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "fotoloco-sicherung-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function importBackup(file){
  if (!file) return;
  try { const n = store.importJSON(await file.text()); toast(n + " Spots geladen."); }
  catch (e) { toast(e.message || "Die Datei konnte nicht gelesen werden."); }
}

/* ---------- Start ---------- */
store.subscribe(() => {
  S.spots = store.all();
  drawSpots();
  if (S.mode !== "form") render();
  drawSun();
});
async function start(){
  if (store.isEmpty()){
    try { const ex = await fetch("data/beispiel-spots.json").then(r => r.json()); store.seed(ex); } catch {}
  }
  S.spots = store.all();
  readHash();
  renderChips();
  render();
  snapTo(S.mode === "spot" ? "half" : "peek");
  drawSpots(); drawSun();
  if (S.mode === "spot" && map){ const s = getSpot(S.sel); s && map.jumpTo({center: [s.lng, s.lat], zoom: 12, padding: mapPadding()}); }
}
window.addEventListener("hashchange", () => { readHash(); render(); drawSpots(); drawSun(); });
window.addEventListener("beforeunload", e => { if (S.mode === "form" && S.dirty){ e.preventDefault(); e.returnValue = ""; } });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { render(); drawSun(); });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
start();
