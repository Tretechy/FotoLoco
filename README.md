# FotoLoco

Eine App für Fotografen und Videografen, um Foto-Locations zu finden, zu teilen und zu planen.

## Idee

- Weltkarte mit Spots (öffentlich oder privat)
- Fotos, YouTube-Videos, Kommentare und Bewertungen nach Kriterien (Motiv, Licht, Ruhe, Erreichbarkeit, Sicherheit)
- Licht-Planer: Sonnenauf- und -untergang, goldene und blaue Stunde, Milchstraße – für jedes Datum
- Infos vor Ort: Anfahrt & Parken, Umziehen für Models, Andrang, Risiko, Rechtliches, Drohnen
- Kategorien u. a. Aussichtspunkt, Parkdeck & Rooftop, Lost Place, Drohnen-Spot, Nacht & Milchstraße

## Stand

- `index.html` – die Web-App (läuft über GitHub Pages). Straßenkarte von OpenFreeMap, Standort, Adresssuche,
  Licht-Planer, Spots, Kommentare und Bewertungen. **Speichert vorerst nur im eigenen Browser** (localStorage);
  die gemeinsame Online-Datenbank folgt.
- `data/beispiel-spots.json` – Beispiel-Spots für den ersten Start.
- `prototyp-claude/` – der erste Prototyp, der als Artifact auf claude.ai läuft.

## Datenquellen
- Straßenkarte: [OpenFreeMap](https://openfreemap.org) mit Daten von [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL)
- Adresssuche: [Nominatim](https://nominatim.org) (OpenStreetMap)

- Kartengrundlage: [Natural Earth](https://www.naturalearthdata.com/) (gemeinfrei), über das npm-Paket `world-atlas`
- Städte: [GeoNames](https://www.geonames.org/) (CC BY 4.0), über das npm-Paket `all-the-cities`
- Karte: [Leaflet](https://leafletjs.com/), Sonnenberechnung: [SunCalc](https://github.com/mourner/suncalc)
