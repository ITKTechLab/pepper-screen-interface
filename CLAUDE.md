# CLAUDE.md — pepper-screen-interface

Statisk HTML/JS-side til Peppers indbyggede tablet + lille HTTP-proxy til `pepper-robot-bridge`. Indeholder også projektets quickstart-scripts.

## Arkitektur

```
Pepper-tablet  ──HTTP──>  app.py (port 5000)  ──HTTP──>  pepper-robot-bridge (port 8080)  ──NAOqi──>  robot
                          ├ serverer static/index.html + app.js
                          └ proxy'er /api/command videre
```

Tabletten åbner `http://<operator-ip>:5000/` (via bridge-kommandoen `show_tablet_url`) og kalder `/api/command` på samme oprindelse. Den lokale proxy videresender til bridge'en — uden proxy ville tabletten ramme CORS-restriktioner mod bridge'ens `localhost:8080`.

## Filer

| Fil | Formål |
|---|---|
| `app.py` | Stdlib HTTP-server + proxy. Ingen pip-deps. |
| `static/index.html` | Knapsamling der vises på tabletten. ES5-grænser pga. tablet-browseren. |
| `static/app.js` | `BridgeApi.call(command, params)` + `Commands.*`-handlers. |
| `scripts/start-local.sh` | Quickstart for Linux/macOS/WSL. |
| `scripts/start-local.ps1` | Quickstart for Windows PowerShell. |
| `scripts/start-local.cmd` | Tynd wrapper omkring `.ps1` med `-ExecutionPolicy Bypass` (til maskiner med restriktiv policy). |

## ES5-grænser i `static/app.js`

Peppers tablet kører en gammel Android-browser. Brug **ikke**:

- `let` / `const` → brug `var`
- Arrow functions (`=>`) → brug `function` keyword
- Template literals (backticks) → brug `'...' + var`
- `fetch` → brug `XMLHttpRequest`
- `class`-syntaks → brug konstruktør-funktioner eller plain objekter
- Optional chaining (`?.`) eller nullish coalescing (`??`)

Konvention: koden grupperes i navnerum (`BridgeApi`, `Commands`) der eksponeres på `window` for inline `onclick`-attributter i HTML'en. Hvis filen vokser væsentligt, kan navnerum splittes ud i separate `<script>`-tags (indlæses sekventielt i `index.html`).

## Bridge-afhængighed

Repoet kender til bridge'en kun gennem HTTP-API'et — der må aldrig være en Python-import fra `pepper_bridge` her. Bridge-hostname/port er konfigurerbar via `--bridge-host`/`--bridge-port` i `app.py`.

Quickstart-scriptsne forventer bridge som søstermappe (`../pepper-robot-bridge`) som default, men accepterer `--bridge-path` for at pege andre steder hen.

## Tilføj en ny knap

1. Tilføj `<button onclick="Commands.minKnap()">...` i `static/index.html`.
2. Tilføj handler i `static/app.js` under `Commands`:
   ```js
   minKnap: function () {
       BridgeApi.call('say', { text: 'Hej' });
   }
   ```
3. Bekræft at `'say'` (eller den kommando du bruger) findes i bridge'ens [api-spec/openapi.yaml](../pepper-robot-bridge/api-spec/openapi.yaml).

Server-koden i `app.py` behøver ikke ændres — den proxy'er alle `POST /api/command`-kald uændret.

## Test

Repoet har ingen automatiserede tests endnu — UI-laget testes manuelt via robot eller browser. For end-to-end-verifikation, brug quickstart-scriptet og klik knapperne mens du kigger på bridge'ens log.
