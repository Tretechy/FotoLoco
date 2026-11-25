// Datenhaltung und Prüfung aller Spot-Daten.
// Alles, was angezeigt wird, läuft vorher durch cleanSpot(): Nur bekannte Werte kommen durch,
// Texte werden gekürzt, Zahlen geprüft. So kann ein manipulierter Datensatz keinen Code einschleusen.

export const CATS = {
  aussicht: "Aussichtspunkt", natur: "Natur & Landschaft", stadt: "Stadt & Architektur",
  parkdeck: "Parkdeck & Rooftop", wasser: "Wasser & Küste", lostplace: "Lost Place",
  drohne: "Drohnen-Spot", nacht: "Nacht & Milchstraße"
};
export const BEST = ["Sonnenaufgang", "Goldene Stunde morgens", "Vormittag", "Mittag", "Nachmittag", "Goldene Stunde abends", "Sonnenuntergang", "Blaue Stunde", "Nacht / Milchstraße"];
export const CHANGING = {vorort: "Umziehen vor Ort gut möglich", auto: "Nur eingeschränkt (z. B. im Auto)", fertig: "Schon umgezogen anreisen"};
export const CROWD = ["Keine Angabe", "Menschenleer", "Wenig los", "Mittel", "Belebt", "Sehr voll"];
export const RISK = {niedrig: "Niedrig", mittel: "Mittel", hoch: "Hoch"};
export const DRONE = {erlaubt: "Erlaubt", eingeschraenkt: "Mit Einschränkungen / Genehmigung", verboten: "Verboten", unklar: "Unklar – vor Ort prüfen"};

const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
const oneOf = (v, obj) => typeof v === "string" && Object.prototype.hasOwnProperty.call(obj, v) ? v : "";
const num = (v, lo, hi) => typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : null;
export const YT = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/[\w\-?=&%./#]*$/i;

export function cleanSpot(id, raw, priv){
  if (!raw || typeof raw !== "object" || typeof id !== "string" || !/^[\w-]{1,80}$/.test(id)) return null;
  const lat = num(raw.lat, -90, 90), lng = num(raw.lng, -180, 180);
  if (lat === null || lng === null) return null;
  return {
    id, priv: !!priv, lat, lng,
    name: str(raw.name, 120).trim() || "Ohne Namen",
    cat: oneOf(raw.cat, CATS) || "aussicht",
    desc: str(raw.desc, 2000),
    bestTimes: Array.isArray(raw.bestTimes) ? raw.bestTimes.filter(b => BEST.includes(b)) : [],
    parking: str(raw.parking, 1500), changing: oneOf(raw.changing, CHANGING),
    crowd: Number.isInteger(raw.crowd) && raw.crowd >= 0 && raw.crowd <= 5 ? raw.crowd : 0,
    risk: oneOf(raw.risk, RISK), legal: str(raw.legal, 1500), drone: oneOf(raw.drone, DRONE),
    videos: Array.isArray(raw.videos) ? raw.videos.filter(u => typeof u === "string" && YT.test(u)).slice(0, 20) : [],
    photos: [],
    example: raw.example === true,
    createdBy: str(raw.createdBy, 80), createdAt: num(raw.createdAt, 0, 1e14) || 0, updatedAt: num(raw.updatedAt, 0, 1e14) || 0
  };
}
// Daten für das Speichern (ohne abgeleitete Felder)
export function toRecord(s){
  const {id, priv, ...rest} = s;
  return rest;
}

/* ---------- Speicher im Browser ----------
   Vorläufig liegt alles im Browser (localStorage). Die Schnittstelle (list/put/remove/subscribe)
   bleibt gleich, wenn später eine Online-Datenbank angeschlossen wird. */
const KEY = "fotoloco-v2";
export function createStore(){
  let data = {pub: {}, priv: {}};
  try {
    const old = JSON.parse(localStorage.getItem("fotoloco-v1") || "null");
    const cur = JSON.parse(localStorage.getItem(KEY) || "null");
    if (cur) data = cur;
    else if (old) { // Daten der ersten Web-Version übernehmen
      for (const [k, v] of Object.entries(old)){
        const [a, b, c, d] = k.split("/");
        if (a === "spots" && b && !c) data.pub[b] = v;
        if (a === "data" && b === "users" && d) data.priv[d] = v;
      }
    }
  } catch {}
  const subs = new Set();
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch { throw new Error("Der Speicher im Browser ist voll."); }
  };
  const emit = () => subs.forEach(f => f());
  return {
    isEmpty: () => !Object.keys(data.pub).length && !Object.keys(data.priv).length,
    all(){
      const out = [];
      for (const [id, r] of Object.entries(data.pub)){ const s = cleanSpot(id, r, false); s && out.push(s); }
      for (const [id, r] of Object.entries(data.priv)){ const s = cleanSpot(id, r, true); s && out.push(s); }
      return out;
    },
    put(spot){
      const rec = toRecord(spot);
      delete data.pub[spot.id]; delete data.priv[spot.id];
      (spot.priv ? data.priv : data.pub)[spot.id] = rec;
      persist(); emit();
    },
    remove(id){ delete data.pub[id]; delete data.priv[id]; persist(); emit(); },
    seed(list){ for (const e of list) data.pub[e.id] = e.data; persist(); emit(); },
    subscribe(f){ subs.add(f); return () => subs.delete(f); },
    exportJSON(){ return JSON.stringify({app: "FotoLoco", version: 2, exportedAt: new Date().toISOString(), spots: data}, null, 1); },
    importJSON(text){
      const j = JSON.parse(text);
      const src = j && j.spots;
      if (!src || typeof src !== "object") throw new Error("Das ist keine FotoLoco-Sicherung.");
      let n = 0;
      for (const kind of ["pub", "priv"]) for (const [id, r] of Object.entries(src[kind] || {})){
        const s = cleanSpot(id, r, kind === "priv");
        if (s){ data[kind][id] = toRecord(s); n++; }
      }
      persist(); emit();
      return n;
    }
  };
}
export const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
