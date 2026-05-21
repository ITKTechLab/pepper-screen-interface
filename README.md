# hardware-proxy-service

Letvægts lokal HTTP-service der serverer en statisk HTML-side til Norma's tablet. Servicen lytter på `0.0.0.0` så tabletten kan tilgå siden over LAN'et fra operatør-maskinen.

## Formål

Norma's tablet åbner en URL via bridge-kommandoen `show_tablet_url`. Dette modul leverer den side. Den er bevidst holdt simpel — ingen frameworks, ingen byggeprocess, ingen eksterne afhængigheder.

## Forhold til resten af workspace

Uafhængigt sub-repo i Norma-Chat-2.0-workspace'et. Lever som søsterklone med eget `.git/`, gitignoreret fra workspace-repoet. Har **ingen** kobling til `norma-robot-bridge`, `norma-input` eller `norma-ui` — det er udelukkende en static-file-server.

## Forudsætninger

- Python 3.11+
- Ingen pip-afhængigheder (bruger kun stdlib)
- Operatør-maskinen skal være på samme LAN som Norma's tablet

## Kør

```powershell
py -3.11 app.py
```

Lytter som default på `0.0.0.0:5000`. Skift port med `--port`:

```powershell
py -3.11 app.py --port 8080
```

Eller bind til en specifik adresse:

```powershell
py -3.11 app.py --host 127.0.0.1 --port 5000
```

## Konfigurér Norma til at åbne siden

1. Find operatør-maskinens LAN-IP (`ipconfig` / `ip a`).
2. Send `show_tablet_url` til bridge'en med adressen — se `norma-robot-bridge/api-spec/openapi.yaml` for den præcise endpoint-form. Eksempel:

   ```
   POST http://<bridge-host>:8080/api/command
   {
     "command": "show_tablet_url",
     "params": { "url": "http://192.168.1.42:5000/" }
   }
   ```

## Browser-kompatibilitet

Norma's tablet kører en gammel Android-browser. `static/index.html` er derfor bevidst skrevet i **ES5**:

- `var` (ikke `let`/`const`)
- Almindelige `function`-udtryk (ingen arrow functions)
- Ingen template literals (backticks)
- Ingen `fetch` — brug `XMLHttpRequest` hvis dynamik bliver nødvendigt
- Ingen optional chaining (`?.`)

Hold dig til disse begrænsninger når siden udbygges.
