# pepper-screen-interface

Letvægts lokal HTTP-service der serverer en statisk tablet-side til **Pepper/NAO** + proxy'er kommandoer videre til [pepper-robot-bridge](https://github.com/bakspace-itk/pepper-robot-bridge). Servicen lytter på `0.0.0.0` så Peppers indbyggede tablet kan tilgå siden over LAN'et fra operator-maskinen.

Dette repo indeholder også **quickstart-scripts** der starter bridge + screen + sender `show_tablet_url` til robotten i ét greb — det er projektets indgangsdør for nye operatører.

## Hvad gør dette repo?

- **Statisk side** (`static/index.html` + `static/app.js`) — den knapsamling Peppers tablet viser
- **HTTP-server** (`app.py`) — serverer siden + proxy'er `POST /api/command` videre til bridge'en (undgår CORS-bekymringer i tabletten)
- **Quickstart** (`scripts/start-local.{sh,ps1}`) — starter bridge + screen + peger robottens tablet på siden

Ingen frameworks, ingen byggeprocess, kun Python stdlib + ES5 i browseren.

## Forudsætninger

- Python 3.11+ (kun stdlib, ingen pip-deps)
- [pepper-robot-bridge](https://github.com/bakspace-itk/pepper-robot-bridge) tilgængelig — typisk som søstermappe (`../pepper-robot-bridge`) med en aktiv `.venv27` der har `pepper_bridge` installeret
- Operator-maskinen og Peppers tablet skal være på samme LAN

## Quickstart

### Linux / macOS / WSL

```bash
./scripts/start-local.sh --robot-ip 192.168.1.155 --operator-ip 192.168.1.143
```

### Windows

Hvis du har en restriktiv PowerShell `ExecutionPolicy` (default på mange firma-maskiner), brug `.cmd`-wrapperen — den kalder PowerShell med bypass:

```cmd
scripts\start-local.cmd -RobotIp 192.168.1.155 -OperatorIp 192.168.1.143
```

Direkte PowerShell-kald:

```powershell
.\scripts\start-local.ps1 -RobotIp 192.168.1.155 -OperatorIp 192.168.1.143
```

Hvis PowerShell afviser scriptet med `running scripts is disabled on this system`, så enten brug `.cmd`-wrapperen ovenfor, eller én af disse uden admin-rettigheder:

```powershell
# Kun denne kørsel
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -RobotIp 192.168.1.155 -OperatorIp 192.168.1.143

# Kun nuværende shell-session
Set-ExecutionPolicy -Scope Process Bypass

# Permanent for din egen bruger (én gang)
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Scriptet:
1. Starter `pepper-robot-bridge` mod den opgivne robot-IP (læser bridge'ens `.venv27`)
2. Starter screen-interface-serveren på port 5000
3. Auto-detekterer operator-maskinens LAN-IP (kan overstyres med `--operator-ip`/`-OperatorIp`)
4. Sender `show_tablet_url` til bridge så robotten åbner siden på sin tablet
5. Holder begge processer kørende indtil `Ctrl+C`

Hvis bridge allerede kører (fx fra en separat terminal), brug `--skip-bridge`/`-SkipBridge` for kun at starte screen-laget.

Hvis bridge ligger et andet sted end `../pepper-robot-bridge`, brug `--bridge-path <sti>` / `-BridgePath <sti>`.

## Kør komponenterne hver for sig

Kun screen-interface (uden bridge):

```bash
# Linux
python3 app.py --port 5000 --bridge-host localhost --bridge-port 8080

# Windows
py -3 app.py --port 5000 --bridge-host localhost --bridge-port 8080
```

Argumenter: `--host`, `--port`, `--bridge-host`, `--bridge-port`.

## Browser-kompatibilitet

Peppers tablet kører en gammel Android-browser. JS-koden i `static/app.js` er bevidst skrevet i **ES5**:

- `var` (ikke `let`/`const`)
- Almindelige `function`-udtryk (ingen arrow functions)
- Ingen template literals (backticks)
- Ingen `fetch` — brug `XMLHttpRequest`
- Ingen optional chaining (`?.`)
- Ingen `class`-syntaks

Hold dig til disse begrænsninger når siden udbygges. Koden er gruppert i konventionsbaserede navnerum:

- `BridgeApi` — det eneste sted hvor `/api/command` kaldes
- `Commands` — knap-handlers eksponeret på `window` for inline `onclick`

Hvis JS-filen vokser betydeligt, kan grupperne opdeles i flere `<script>`-tags. Det er ikke nødvendigt nu.

## Hvor er Norma?

Dette repo er en del af et større projekt der bruger Pepper-robotter i kommunale formål under navnet **Norma**. Koden her er generisk Pepper-tooling; Norma-konfiguration (intro-tekster, specifikke gesture-valg, kommando-bundles) hører hjemme i `pepper-robot-bridge`'s `config/local.ini` eller i en konkret deployment, ikke i denne kodebase.
