# Filmatelier

Offline werkende PWA om een speelfilm te bedenken, schrijven en produceren. Geen build-stap en geen runtime-afhankelijkheden: gewone HTML, CSS en ES-modules.

**Live:** https://ischabiesbrouck.github.io/filmatelier/ — open de link en kies in de browser “App installeren” om hem als app te gebruiken. Je projecten blijven altijd lokaal op je eigen apparaat.

Een nieuwe versie publiceren = committen en pushen naar `main`; GitHub Pages bouwt automatisch opnieuw. Verhoog bij elke release `VERSION` in `sw.js`, zodat bestaande gebruikers de melding “Nieuwe versie beschikbaar” krijgen.

## Starten en testen

```bash
npm start
```

Open daarna http://localhost:8790. Publiceren = de hele map uploaden naar een statische host (Netlify, GitHub Pages…). HTTPS is nodig om de app te kunnen installeren.

```bash
npm test
```

Draait de tests in `tests/` met de ingebouwde testrunner van Node (≥ 20): Fountain-parser en paginering, FDX heen en terug, scènesleutels bij vastzetten/verplaatsen/invoegen, migraties, budget, analyse, leesrepetitie, timecode en zonstanden.

## Onderdelen

| Fase | Onderdelen |
|---|---|
| Start | Overzicht (filmkaart, voortgangsmeter, draaikalender, takentijdlijn) |
| Ontwikkeling | Ideeënlab (bord, generatoren, premisse & thema, loglinebouwer) · Structuur (Save the Cat, 3 akten, heldenreis, story circle, sequenties, 7-punts, Freytag, kishōtenketsu) · Personages (bijbel, psychologisch profiel, relatiematrix) · Wereld & research · Synopsis & treatment |
| Schrijven | Scenario-editor (Fountain, slimme Enter/Tab, autocomplete, live paginavoorbeeld, versies, zoeken/vervangen, import/export Fountain/FDX/PDF, schrijfsprint, dagdoel, afleidingsvrije modus) · Scènekaarten · Scenario-analyse (tijdlijn met beats, ritme, wie-is-waar, dialoogverdeling, woordgebruik, signaleringen) · Leesrepetitie (voorlezen met een stem per personage) |
| Pre-productie | Breakdown (incl. verhaaldag) · Shotlist & storyboard · Draaischema · Cast & crew · Locaties · Apparatuur · Budget · Moodboard · Planning & taken |
| Productie | Callsheets (zon/gouden uur per locatie) · Opnamelog / dagrapport |
| Post & distributie | Montageversies, VFX, muziekcues, ADR, deliverables · Festivals & perskit |
| Gereedschap | Rekenhulpen (zon, scherptediepte, timecode, opslag, speelduur, sluiter, beeldverhouding) · Gids & sjablonen (per fase, opmaakregels, woordenlijst, financiering & regels, overeenkomsten) · Project & back-up |

Overal: **Ctrl+K** opent het zoek- en opdrachtpalet (scènes, personages, locaties, taken, ideeën, acties).

## Techniek

- **Opslag** (`js/store.js`): IndexedDB v2 met de stores `projects`, `backups` en `meta`. Elk project is één document met een `version` (schema); `migrate()` brengt oudere projecten stap voor stap bij.
- **Back-ups**: bij het werken maximaal één automatische momentopname per uur per project (laatste 15 bewaard); terugzetten maakt eerst zelf een back-up. Optioneel schrijft `js/folder.js` het project (.json) en het scenario (.fountain) naar een gekozen map (File System Access API, Chrome/Edge desktop). Export/import van één project of alle projecten in één bestand.
- **Meerdere vensters**: opslaan wordt via `BroadcastChannel` gemeld; andere vensters met hetzelfde project herladen stil (als er niets openstaat) of tonen een melding.
- **Scènesleutels**: breakdown, shots en planning verwijzen naar scènes met `n:12` (vastgezet nummer) of kop + volgnummer. Hernoemen, vastzetten, verplaatsen en invoegen verhuizen gekoppelde gegevens automatisch (`js/scenes.js`); losgeraakte gegevens zijn te herkoppelen in Breakdown.
- **Foutafhandeling**: globale vangst van onverwachte fouten (melding zonder te spammen) en een duidelijke melding bij volle opslag.
- **Service worker** (`sw.js`): netwerk eerst met hervalidatie, cache als terugval; lettertypes worden apart gecachet. Een nieuwe module moet ook in `SHELL`; verhoog dan `VERSION`.
- **AI-schrijfhulp** (`js/ai.js`): optioneel, via de Claude API met een eigen API-sleutel die alleen lokaal wordt bewaard. De SDK wordt pas geladen bij het eerste gebruik. Standaardmodel Claude Opus 5.5, met server-side fallback bij weigeringen.
