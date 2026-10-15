# FotoLoco

Eine App für Fotografen und Videografen, um Foto-Locations zu finden, zu teilen und zu planen.

## Idee

- Weltkarte mit Spots (öffentlich oder privat)
- Fotos, YouTube-Videos, Kommentare und Bewertungen nach Kriterien (Motiv, Licht, Ruhe, Erreichbarkeit, Sicherheit)
- Licht-Planer: Sonnenauf- und -untergang, goldene und blaue Stunde, Milchstraße – für jedes Datum
- Infos vor Ort: Anfahrt & Parken, Umziehen für Models, Andrang, Risiko, Rechtliches, Drohnen
- Kategorien u. a. Aussichtspunkt, Parkdeck & Rooftop, Lost Place, Drohnen-Spot, Nacht & Milchstraße

## Stand

`prototyp-claude/` enthält den ersten Prototyp. Er läuft als Artifact auf claude.ai und nutzt dort die eingebaute
Datenbank. Außerhalb von claude.ai zeigt er Karte und Licht-Planer, kann aber noch nichts speichern.

## Datenquellen

- Kartengrundlage: [Natural Earth](https://www.naturalearthdata.com/) (gemeinfrei), über das npm-Paket `world-atlas`
- Städte: [GeoNames](https://www.geonames.org/) (CC BY 4.0), über das npm-Paket `all-the-cities`
- Karte: [Leaflet](https://leafletjs.com/), Sonnenberechnung: [SunCalc](https://github.com/mourner/suncalc)
