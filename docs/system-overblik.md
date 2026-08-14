# Norma Systemoverblik

Denne fil forklarer, hvordan Norma-loesningen paa Nuuk haenger sammen, og hvilke dele der er kerne, fallback eller potentielt kan ryddes op senere.

## De vigtigste lag

1. `scripts/norma-runner.sh`
   Samler drift af bridge + screen-interface. Dette er det vigtigste driftslag.

2. `scripts/run-resilient.sh`
   Wrapper omkring `start-local.sh`, som auto-genstarter ved crash.

3. `scripts/start-local.sh`
   Starter `pepper-robot-bridge`, starter `app.py`, og sender `show_tablet_url` til robotten.

4. `app.py`
   Serverer Pepper-tablet UI fra `static/` og proxy'er `/api/command` til bridge'en.

5. `scripts/norma-nuuk-control-server.py` + `static/nuuk-control/`
   Officiel Nuuk-operatorflade. Browser-UI til driftspersonale paa computeren.

6. `scripts/norma-operator-panel.py`
   Fallback-driftpanel. Bruges hvis Nuuk Control ikke virker eller browser-UI ikke kan aabnes.

## Officielle brugerflader

1. `Norma Nuuk Control`
   Primær indgang for driftspersonale.

2. `Norma Driftpanel (Terminal)`
   Fallback hvis browser-UI fejler.

## Tablet UI vs. Nuuk UI

1. `static/index.html`, `static/emotes.html`, `static/app.js`
   Dette er robot/tablet-oplevelsen til borgerne.

2. `static/nuuk-control/index.html`
   Dette er driftspanelet paa Nuuk-computeren.

De to UI'er har forskellige brugere og boer holdes adskilt.

## Dele der kan vaere kandidater til oprydning senere

1. `static/talk.html`, `static/talk.js`
   Talk-/biblioteksbeta. Kun behold hvis I aktivt vil videre med den.

2. Boganbefaler-endpoints i `app.py`
   `/api/book-recommendation` og `/api/transcribe` er kun relevante for talk-betaen.

3. Skjulte launcher-genveje
   `Norma Start`, `Norma Vis Skaerm`, `Norma Status`, `Norma Stop` er nu driftshelpers og ikke primaere entry points.

## Hvis du vil forstaa systemet i rigtig raekkefolge

1. Start med `scripts/norma-runner.sh`
2. Laes derefter `scripts/start-local.sh`
3. Se saa `app.py`
4. Derefter `static/app.js` og tablet-siderne
5. Til sidst `scripts/norma-nuuk-control-server.py` og `static/nuuk-control/index.html`

Det giver den korteste vej fra drift til implementering.