# FotoLoco

Eine Web-App für Fotografen und Videografen, um Foto-Locations zu finden, zu teilen und zu planen.

**Live:** https://tretechy.github.io/FotoLoco/

## Funktionen

- Karte im Vollbild (OpenFreeMap) mit **Satellitenbild** zum Umschalten
- Spots in 8 Kategorien, u. a. Parkdeck & Rooftop, Lost Place, Drohnen-Spot, Nacht & Milchstraße
- **Licht-Planer** in der Ortszeit des Spots: blaue und goldene Stunde, Sonnenauf- und -untergang mit Richtung,
  Sonnenstand und Schattenlänge zu jeder Uhrzeit, Linien auf der Karte
- **Wetter** (Bewölkung tief/hoch, Regen) zu Sonnenaufgang, Sonnenuntergang und gewählter Uhrzeit
- **Milchstraße**: Sichtbarkeitsfenster, höchster Stand mit Richtung, ob der Mond stört
- Infos vor Ort: Anfahrt & Parken, Umziehen für Models, Andrang, Risiko, Rechtliches, Drohne
- Spots öffentlich oder privat speichern, **Teilen per Link**, Sicherung als Datei
- Ortssuche inkl. Parkhäuser, eigener Standort
- Als App auf dem Handy installierbar, startet auch offline

## Stand

Spots werden vorerst **nur im Browser** gespeichert (localStorage). Die Speicher-Schnittstelle in `js/store.js` ist so
gebaut, dass später eine Online-Datenbank angeschlossen werden kann. Dann kommen Fotos, Bewertungen und Kommentare.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Seitengerüst |
| `css/app.css` | Gestaltung (helles und dunkles Design) |
| `js/app.js` | Oberfläche, Karte, Suche, Formular |
| `js/astro.js` | Berechnungen für Sonne, Mond, Milchstraße und Zeitzonen |
| `js/store.js` | Speicher und Prüfung aller Spot-Daten |
| `js/pins.js` | Stecknadel-Symbole |
| `vendor/` | Bibliotheken (MapLibre GL JS, SunCalc, tz-lookup), lokal ausgeliefert |
| `fonts/` | Schriften, lokal ausgeliefert (keine Verbindung zu Google) |
| `tests/` | Automatische Tests für den Rechenkern |
| `sw.js`, `manifest.webmanifest` | Installierbare App und Offline-Start |
| `prototyp-claude/` | Erster Prototyp (claude.ai-Artifact) |

## Tests

```
npm test
```

Die Tests laufen absichtlich in der Zeitzone Asia/Tokyo, um sicherzustellen, dass alle Zeiten in der Ortszeit des Spots
berechnet werden und nicht in der des Geräts.

## Vor einem öffentlichen Start offen

- **Impressum und Datenschutz** (`impressum.html`, `datenschutz.html`) sind Entwürfe: Platzhalter ausfüllen, rechtlich prüfen lassen.
- **Satellitenbild (Esri World Imagery)**: Nutzungsbedingungen prüfen. Für den Dauerbetrieb ist voraussichtlich ein
  (kostenloses) ArcGIS-Konto mit API-Schlüssel nötig oder ein anderer Anbieter.
- **Wetter (Open-Meteo)**: kostenlos nur für nicht-kommerzielle Nutzung. Mit einer Bezahlversion wird ein Tarif nötig.
- **Ortssuche (Photon)**: Der öffentliche Server ist für moderate Nutzung gedacht. Bei vielen Nutzern eigenen Server oder Anbieter wählen.

## Datenquellen und Lizenzen

- Karte: [OpenFreeMap](https://openfreemap.org), © [OpenMapTiles](https://www.openmaptiles.org/), Daten © [OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright) (ODbL)
- Satellitenbild: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP und die GIS User Community
- Wetter: [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0)
- Ortssuche: [Photon](https://photon.komoot.io/) von komoot
- Städte: [GeoNames](https://www.geonames.org/) (CC BY 4.0)
- Bibliotheken: [MapLibre GL JS](https://maplibre.org/) (BSD-3), [SunCalc](https://github.com/mourner/suncalc) (BSD-2), [tz-lookup](https://github.com/photostructure/tz-lookup) (CC0)
- Schriften: Archivo, Instrument Sans, JetBrains Mono (SIL Open Font License)
