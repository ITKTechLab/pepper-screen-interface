# pepper-screen-interface

Letvægts lokal HTTP-service der serverer en statisk tablet-side til **Pepper/NAO** + proxy'er kommandoer videre til [pepper-robot-bridge](https://github.com/ITKTechLab/pepper-robot-bridge). Servicen lytter på `0.0.0.0` så Peppers indbyggede tablet kan tilgå siden over LAN'et fra operator-maskinen.

Dette repo indeholder også **quickstart-scripts** der starter bridge + screen + sender `show_tablet_url` til robotten i ét greb — det er projektets indgangsdør for nye operatører.

## Hvad gør dette repo?

- **Statisk side** (`static/index.html` + `static/app.js`) — den knapsamling Peppers tablet viser
- **HTTP-server** (`app.py`) — serverer siden + proxy'er `POST /api/command` videre til bridge'en (undgår CORS-bekymringer i tabletten)
- **Quickstart** (`scripts/start-local.{sh,ps1}`) — starter bridge + screen + peger robottens tablet på siden

Ingen frameworks, ingen byggeprocess, kun Python stdlib + ES5 i browseren.

## Forudsætninger

- Python 3.11+ (kun stdlib, ingen pip-deps)
- [pepper-robot-bridge](https://github.com/ITKTechLab/pepper-robot-bridge) tilgængelig — typisk som søstermappe (`../pepper-robot-bridge`) med en aktiv `.venv27` der har `pepper_bridge` installeret
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

## Robust drift (auto-genstart ved crash)

Til offentlige demoopsætninger kan du bruge en resilient wrapper, der genstarter hele flowet automatisk hvis processen crasher:

```bash
./scripts/run-resilient.sh --robot-ip 192.168.1.155 --operator-ip 192.168.1.143
```

Wrapperen stopper ikke med det samme ved fejl, men forsøger igen efter kort ventetid. `Ctrl+C` stopper stadig hele setup'et bevidst.

## Drift Uden Copilot (anbefalet i borgerdrift)

For at gore opstart robust og nem for kolleger, er der nu et fast runner-flow med
start/stop/status-kommandoer og desktop-genveje.

Bridge-delen er indbygget i samme flow: `Start`/`Stop`/`Genstart` styrer baade
pepper-robot-bridge og screen-interface samlet.

1. Konfigurer robot-IP (kun en gang):

```bash
cp config/operator.env.example config/operator.env
# Rediger ROBOT_IP i filen hvis noedvendigt
```

I denne installation er `config/operator.env` allerede oprettet med `ROBOT_IP=192.168.1.155`.

2. Installer desktop-genveje (kun en gang):

```bash
./scripts/install-desktop-launchers.sh
```

Det opretter app-menu-genveje:

- `Norma Nuuk Control` (officiel browser-baseret operatorflade)
- `Norma Driftpanel (Terminal)` (fallback hvis browser-UI fejler)

Foelgende hjaelpegenveje installeres stadig, men skjules fra app-menuen:

- `Norma Start`
- `Norma Vis Skaerm`
- `Norma Status`
- `Norma Stop`

3. Daglig brug (uden terminal):

- Start (officiel): aabn `Norma Nuuk Control` og brug knapperne der
- Fallback: aabn `Norma Driftpanel (Terminal)` hvis browser-UI ikke virker paa maskinen
- Alternativt: aabn `Norma Start`
- Hvis tablet ikke skifter: aabn `Norma Vis Skaerm`
- Fejlsoegning: aabn `Norma Status`
- Nedlukning: aabn `Norma Stop`

4. Valgfrit auto-start ved login:

```bash
./scripts/install-desktop-launchers.sh --autostart
```

### Runner-kommandoer (teknisk)

```bash
./scripts/norma-runner.sh start
./scripts/norma-runner.sh show
./scripts/norma-runner.sh status
./scripts/norma-runner.sh stop
./scripts/norma-runner.sh logs
```

Runneren bruger `run-resilient.sh` i baggrunden, saa flowet auto-genstarter ved crash.

## Forstaa Systemet

Hvis du vil forstaa og senere rydde op i loesningen, start her:

1. Laes [docs/system-overblik.md](/home/norma/Normachat/pepper-screen-interface/docs/system-overblik.md)
2. Start derefter med `scripts/norma-runner.sh`
3. Gaa saa videre til `scripts/start-local.sh`, `app.py`, tablet-UI og til sidst `Norma Nuuk Control`

## Beta: Snak med Norma (lokal boganbefaler)

Der er nu en lokal beta-side i [static/talk.html](static/talk.html):

- Knap på forsiden: "Snak med Norma"
- Whisper-flow via `POST /api/transcribe`
- Lokal anbefaling via Ollama på `POST /api/book-recommendation`
- Bogkatalog fra `static/data/books.json`
- Auto-retur til hovedskærm efter 30 sekunder

Denne version er lavet til udvikling uden robot. Mikrofon-input kan kobles på senere,
men resten af pipeline er klar lokalt:

1. UI sender tekst til `/api/transcribe` (dev-bypass indtil mikrofon er aktiv)
2. Backend kalder Whisper (når audio-base64 bruges)
3. Backend sender transskriberet tekst + bogliste til lokal Ollama
4. UI viser anbefaling og sender taletekst videre til bridge når tilgængelig

Krav for lokal AI:

- Ollama kørende lokalt, fx `ollama serve`
- En model pull'et lokalt, fx `ollama pull llama3.1:8b`
- Whisper CLI installeret (kun nødvendigt for reel audio-transskription)

Nye app-argumenter:

- `--ollama-url` (default `http://127.0.0.1:11434/api/generate`)
- `--ollama-model` (default `llama3.1:8b`)
- `--whisper-cmd` (default `whisper`)

## Kør komponenterne hver for sig

Kun screen-interface (uden bridge):

```bash
# Linux
python3 app.py --port 5000 --bridge-host localhost --bridge-port 8080

# Windows
py -3 app.py --port 5000 --bridge-host localhost --bridge-port 8080
```

Lokal udvikling helt uden robot/bridge (mock-svar på `/api/command`):

```bash
python3 app.py --host 127.0.0.1 --port 5000 --mock-bridge
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
