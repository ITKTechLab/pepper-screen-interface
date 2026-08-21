// pepper-screen-interface tablet-UI
//
// Kører i Peppers indbyggede tablet-browser (gammel Android WebView). Derfor
// ES5: var, almindelige function-udtryk, ingen fetch/arrow/template-literals.
//
// Konvention: koden er gruppert i to navnerum:
//   - BridgeApi: HTTP-laget (ét sted hvor /api/command bliver kaldt).
//   - Commands: knap-handlers der eksponeres på window for onclick-attributter.

(function () {
    'use strict';

    var STORAGE_KEY_VOLUME = 'norma_volume';
    var STORAGE_KEY_LANGUAGE = 'norma_language';
    var currentVolume = 100;
    var currentLanguage = 'da';
    var unlockHoldTimer = null;
    var autoHideTimer = null;
    var isVolumeControlsVisible = false;

    var I18N = {
        da: {
            ui: {
                indexPageTitle: 'Norma Control udviklet af ITK',
                emotesPageTitle: 'Se Normas seje muligheder!',
                talkPageTitle: 'Snak med Norma',
                heroTitle: 'Tryk og se hvad Norma kan!',
                btnSayHello: 'Sig hej',
                btnPlayGesture: 'Afspil tilfældig gestus',
                btnPrutbanan: 'Prutbanan',
                btnEmotes: 'Leg med Norma!',
                volumeTitle: 'Lydniveau',
                volumeHint: 'lydkontrol.',
                btnVolumeUnlock: 'lydkontrol',
                volumeVoicePrefix: 'Norma stemme:',
                btnVolDown: '-10%',
                btnVolUp: '+10%',
                btnTestSound: 'Test lyd',
                btnHideVolume: 'Skjul lydkontrol',
                systemTitle: 'System',
                btnStatus: 'Status',
                statusPlaceholder: 'Status vises her...',
                emotesTitle: 'Se Norma\'s seje muligheder!',
                emotesSubtitle: 'Tryk pa en knap og se Norma lave ting!',
                btnHome: 'Hovedmenu',
                btnEmotesNav: 'Emoter',
                btnReloadPage: 'Genindlaes side',
                languageSelectorLabel: 'Sprogvaelger',
                footerCredit: 'udviklet af ITK',
                talkTitle: 'Snak med Norma',
                talkSubtitle: 'Fortael hvad du er i humoer til, sa finder jeg en bog.',
                talkRecordStart: 'Anbefal mig en bog',
                talkRecordStop: 'Stop optagelse',
                talkAnother: 'Anbefal en anden bog',
                talkHintIdle: 'Mikrofon er ikke koblet pa endnu. Brug tekstfeltet og knappen.',
                talkHintRecording: 'Optagelse simuleres. Tryk igen for at behandle via Whisper/Ollama-flow.',
                talkFallbackLabel: 'Interesse (Whisper dev-input indtil mikrofon er koblet pa)',
                talkFallbackPlaceholder: 'Eksempel: Jeg vil gerne have en sjov fantasy-bog',
                talkRecommendationEmpty: 'Ingen anbefaling endnu.',
                talkBooksLoading: 'Indlaeser boeger...',
                talkBooksPending: 'Boeger indlaeses senere',
                talkReadyForInput: 'Klar til input... tryk igen for at koere Whisper/Ollama-flow.',
                talkWorkingRecommendation: 'Arbejder pa anbefaling via Ollama...',
                talkRecommendationError: 'Fejl ved anbefaling: {status}.',
                talkRecommendationUnavailable: 'Kunne ikke finde anbefaling lige nu.',
                talkRecommendationTitleLine: 'Anbefaling: {title}',
                talkRecommendationAuthorLine: 'Forfatter: {author}',
                talkRecommendationWhyLine: 'Hvorfor: {reason}',
                talkRecommendationNormaLine: 'Norma siger: {reply}',
                talkRecommendationMoreLine: 'Vil du have en mere?',
                talkEngineLine: 'Engine: {engine}',
                talkUnknownTitle: 'Ukendt titel',
                talkUnknownAuthor: 'Ukendt',
                talkDefaultInterest: 'Jeg er aaben for en god bog med spaending og humor',
                talkBookStripItem: 'BOG: {title} af {author}',
                talkInvalidRecommendationResponse: 'Ugyldigt svar fra anbefaleren.',
                talkPreparingTranscript: 'Klargor transskription via Whisper-flow...',
                talkTranscriptError: 'Transskription fejlede: {status}.',
                talkTranscriptUnknownError: 'ukendt fejl',
                talkInvalidTranscriptResponse: 'Ugyldigt svar fra transskription.',
                statusVolumeSet: 'Lydniveau sat til {value}%. Tryk "Test lyd" for at hoere det.',
                statusControlsHidden: 'Lydkontrol skjult.',
                statusControlsHiddenAuto: 'Lydkontrol skjult. Hold knappen nede igen for at aabne.',
                statusControlsOpen: 'Lydkontrol aabnet i 15 sekunder.',
                statusHoldToOpen: 'Holder... lydkontrol aabner om 3 sekunder.',
                statusHoldCancelled: 'Hold afbrudt.',
                statusUnknownEmote: 'Ukendt emote: {key}',
                statusRunningEmote: 'Korer emote: {label}',
                statusSending: 'Sender {command}...',
                statusInvalidBridgeResponse: 'Ugyldigt svar fra bridge: {response}',
                statusBridgeError: 'Fejl {status}: {response}',
                statusLanguageChanged: 'Sprog skiftet til dansk.'
            },
            emotes: {
                hello: { label: 'Hej', description: 'Norma siger hej', speech: 'Hej, jeg er her.' },
                bow: { label: 'Buk', description: 'Norma bukker', speech: 'Jeg bukker mig.' },
                wave: { label: 'Vink', description: 'Norma vinker', speech: 'Jeg vinker.' },
                thinking: { label: 'Taenk', description: 'Norma taenker', speech: 'Jeg taenker nu.' },
                come_on: { label: 'Kom med', description: 'Norma kalder', speech: 'Kom med mig.' },
                show: { label: 'Vis', description: 'Norma viser', speech: 'Jeg viser det her.' },
                happy: { label: 'Glad', description: 'Norma er glad', speech: 'Jeg er glad og du er en prutbanan.' },
                excited: { label: 'Spaendt', description: 'Norma er spaendt', speech: 'Jeg er spaendt.' }
            },
            speech: {
                hello: 'Hej',
                prutbanan: 'Du er en prutbanan',
                volumeSample: 'Det her er mit aktuelle lydniveau.'
            }
        },
        en: {
            ui: {
                indexPageTitle: 'Norma Control developed by ITK',
                emotesPageTitle: 'See Norma\'s cool skills!',
                talkPageTitle: 'Talk with Norma',
                heroTitle: 'Tap and see what Norma can do!',
                btnSayHello: 'Say hello',
                btnPlayGesture: 'Play random gesture',
                btnPrutbanan: 'Banana joke',
                btnEmotes: 'Play with Norma!',
                volumeTitle: 'Volume',
                volumeHint: 'audio controls.',
                btnVolumeUnlock: 'audio controls',
                volumeVoicePrefix: 'Norma voice:',
                btnVolDown: '-10%',
                btnVolUp: '+10%',
                btnTestSound: 'Test sound',
                btnHideVolume: 'Hide audio controls',
                systemTitle: 'System',
                btnStatus: 'Status',
                statusPlaceholder: 'Status appears here...',
                emotesTitle: 'See Norma\'s cool skills!',
                emotesSubtitle: 'Tap a button and watch Norma perform!',
                btnHome: 'Home menu',
                btnEmotesNav: 'Emotes',
                btnReloadPage: 'Reload page',
                languageSelectorLabel: 'Language selector',
                footerCredit: 'developed by ITK',
                talkTitle: 'Talk with Norma',
                talkSubtitle: 'Tell me what mood you are in, and I will find a book.',
                talkRecordStart: 'Recommend me a book',
                talkRecordStop: 'Stop recording',
                talkAnother: 'Recommend another book',
                talkHintIdle: 'Microphone is not connected yet. Use the text field and the button.',
                talkHintRecording: 'Recording is simulated. Press again to process through the Whisper/Ollama flow.',
                talkFallbackLabel: 'Interest (Whisper dev-input until mic is connected)',
                talkFallbackPlaceholder: 'Example: I would like a funny fantasy book',
                talkRecommendationEmpty: 'No recommendation yet.',
                talkBooksLoading: 'Loading books...',
                talkBooksPending: 'Books will load later',
                talkReadyForInput: 'Ready for input... press again to run the Whisper/Ollama flow.',
                talkWorkingRecommendation: 'Working on recommendation via Ollama...',
                talkRecommendationError: 'Recommendation error: {status}.',
                talkRecommendationUnavailable: 'Could not find a recommendation right now.',
                talkRecommendationTitleLine: 'Recommendation: {title}',
                talkRecommendationAuthorLine: 'Author: {author}',
                talkRecommendationWhyLine: 'Why: {reason}',
                talkRecommendationNormaLine: 'Norma says: {reply}',
                talkRecommendationMoreLine: 'Would you like another one?',
                talkEngineLine: 'Engine: {engine}',
                talkUnknownTitle: 'Unknown title',
                talkUnknownAuthor: 'Unknown',
                talkDefaultInterest: 'I am open to a great book with excitement and humor',
                talkBookStripItem: 'BOOK: {title} by {author}',
                talkInvalidRecommendationResponse: 'Invalid response from recommender.',
                talkPreparingTranscript: 'Preparing transcription via Whisper flow...',
                talkTranscriptError: 'Transcription failed: {status}.',
                talkTranscriptUnknownError: 'unknown error',
                talkInvalidTranscriptResponse: 'Invalid response from transcription.',
                statusVolumeSet: 'Volume set to {value}%. Press "Test sound" to hear it.',
                statusControlsHidden: 'Audio controls hidden.',
                statusControlsHiddenAuto: 'Audio controls hidden. Hold the button again to open.',
                statusControlsOpen: 'Audio controls open for 15 seconds.',
                statusHoldToOpen: 'Holding... audio controls open in 3 seconds.',
                statusHoldCancelled: 'Hold canceled.',
                statusUnknownEmote: 'Unknown emote: {key}',
                statusRunningEmote: 'Running emote: {label}',
                statusSending: 'Sending {command}...',
                statusInvalidBridgeResponse: 'Invalid response from bridge: {response}',
                statusBridgeError: 'Error {status}: {response}',
                statusLanguageChanged: 'Language changed to English.'
            },
            emotes: {
                hello: { label: 'Hello', description: 'Norma says hello', speech: 'Hello, I am here.' },
                bow: { label: 'Bow', description: 'Norma bows', speech: 'I bow to you.' },
                wave: { label: 'Wave', description: 'Norma waves', speech: 'I am waving.' },
                thinking: { label: 'Think', description: 'Norma thinks', speech: 'I am thinking now.' },
                come_on: { label: 'Come along', description: 'Norma calls you over', speech: 'Come with me.' },
                show: { label: 'Show', description: 'Norma shows something', speech: 'Let me show you this.' },
                happy: { label: 'Happy', description: 'Norma is happy', speech: 'I am happy and full of energy.' },
                excited: { label: 'Excited', description: 'Norma is excited', speech: 'I am really excited.' }
            },
            speech: {
                hello: 'Hello',
                prutbanan: 'You are a banana goofball',
                volumeSample: 'This is my current voice level.'
            }
        },
        de: {
            ui: {
                indexPageTitle: 'Norma Control entwickelt von ITK',
                emotesPageTitle: 'Sieh Normas tolle Faehigkeiten!',
                talkPageTitle: 'Sprich mit Norma',
                heroTitle: 'Tippe und sieh, was Norma kann!',
                btnSayHello: 'Sag hallo',
                btnPlayGesture: 'Zufallsgeste starten',
                btnPrutbanan: 'Bananenwitz',
                btnEmotes: 'Spiel mit Norma!',
                volumeTitle: 'Lautstaerke',
                volumeHint: 'Audiosteuerung.',
                btnVolumeUnlock: 'Audiosteuerung',
                volumeVoicePrefix: 'Norma Stimme:',
                btnVolDown: '-10%',
                btnVolUp: '+10%',
                btnTestSound: 'Sound testen',
                btnHideVolume: 'Audiosteuerung ausblenden',
                systemTitle: 'System',
                btnStatus: 'Status',
                statusPlaceholder: 'Status wird hier angezeigt...',
                emotesTitle: 'Sieh Normas tolle Faehigkeiten!',
                emotesSubtitle: 'Tippe auf einen Knopf und sieh Norma in Aktion!',
                btnHome: 'Hauptmenue',
                btnEmotesNav: 'Emotes',
                btnReloadPage: 'Seite neu laden',
                languageSelectorLabel: 'Sprachauswahl',
                footerCredit: 'entwickelt von ITK',
                talkTitle: 'Sprich mit Norma',
                talkSubtitle: 'Sag mir, worauf du Lust hast, dann finde ich ein Buch.',
                talkRecordStart: 'Empfiehl mir ein Buch',
                talkRecordStop: 'Aufnahme stoppen',
                talkAnother: 'Ein anderes Buch empfehlen',
                talkHintIdle: 'Mikrofon ist noch nicht verbunden. Nutze das Textfeld und die Taste.',
                talkHintRecording: 'Aufnahme wird simuliert. Erneut druecken, um den Whisper/Ollama-Ablauf zu starten.',
                talkFallbackLabel: 'Interesse (Whisper-Dev-Eingabe bis Mikrofon verbunden ist)',
                talkFallbackPlaceholder: 'Beispiel: Ich moechte ein lustiges Fantasy-Buch',
                talkRecommendationEmpty: 'Noch keine Empfehlung.',
                talkBooksLoading: 'Buecher werden geladen...',
                talkBooksPending: 'Buecher werden spaeter geladen',
                talkReadyForInput: 'Bereit fuer Eingabe... erneut druecken, um den Whisper/Ollama-Ablauf zu starten.',
                talkWorkingRecommendation: 'Empfehlung wird ueber Ollama erstellt...',
                talkRecommendationError: 'Fehler bei Empfehlung: {status}.',
                talkRecommendationUnavailable: 'Gerade konnte keine Empfehlung gefunden werden.',
                talkRecommendationTitleLine: 'Empfehlung: {title}',
                talkRecommendationAuthorLine: 'Autor: {author}',
                talkRecommendationWhyLine: 'Warum: {reason}',
                talkRecommendationNormaLine: 'Norma sagt: {reply}',
                talkRecommendationMoreLine: 'Moechtest du noch eine?',
                talkEngineLine: 'Engine: {engine}',
                talkUnknownTitle: 'Unbekannter Titel',
                talkUnknownAuthor: 'Unbekannt',
                talkDefaultInterest: 'Ich bin offen fuer ein gutes Buch mit Spannung und Humor',
                talkBookStripItem: 'BUCH: {title} von {author}',
                talkInvalidRecommendationResponse: 'Ungueltige Antwort vom Empfehlungsdienst.',
                talkPreparingTranscript: 'Transkription ueber Whisper wird vorbereitet...',
                talkTranscriptError: 'Transkription fehlgeschlagen: {status}.',
                talkTranscriptUnknownError: 'unbekannter Fehler',
                talkInvalidTranscriptResponse: 'Ungueltige Antwort von der Transkription.',
                statusVolumeSet: 'Lautstaerke auf {value}% gesetzt. Druecke "Sound testen", um es zu hoeren.',
                statusControlsHidden: 'Audiosteuerung ausgeblendet.',
                statusControlsHiddenAuto: 'Audiosteuerung ausgeblendet. Halte die Taste erneut zum Oeffnen.',
                statusControlsOpen: 'Audiosteuerung fuer 15 Sekunden geoeffnet.',
                statusHoldToOpen: 'Halten... Audiosteuerung oeffnet in 3 Sekunden.',
                statusHoldCancelled: 'Halten abgebrochen.',
                statusUnknownEmote: 'Unbekanntes Emote: {key}',
                statusRunningEmote: 'Emote laeuft: {label}',
                statusSending: 'Sende {command}...',
                statusInvalidBridgeResponse: 'Ungueltige Antwort von der Bridge: {response}',
                statusBridgeError: 'Fehler {status}: {response}',
                statusLanguageChanged: 'Sprache auf Deutsch gestellt.'
            },
            emotes: {
                hello: { label: 'Hallo', description: 'Norma sagt hallo', speech: 'Hallo, ich bin da.' },
                bow: { label: 'Verbeugen', description: 'Norma verbeugt sich', speech: 'Ich verbeuge mich.' },
                wave: { label: 'Winken', description: 'Norma winkt', speech: 'Ich winke dir zu.' },
                thinking: { label: 'Denken', description: 'Norma denkt nach', speech: 'Ich denke jetzt nach.' },
                come_on: { label: 'Komm mit', description: 'Norma ruft dich', speech: 'Komm mit mir.' },
                show: { label: 'Zeigen', description: 'Norma zeigt etwas', speech: 'Ich zeige dir das hier.' },
                happy: { label: 'Froh', description: 'Norma ist froh', speech: 'Ich bin froh und voller Energie.' },
                excited: { label: 'Aufgeregt', description: 'Norma ist aufgeregt', speech: 'Ich bin sehr aufgeregt.' }
            },
            speech: {
                hello: 'Hallo',
                prutbanan: 'Du bist ein Bananenwitzbold',
                volumeSample: 'Das ist meine aktuelle Stimmlautstaerke.'
            }
        }
    };

    function setStatus(value) {
        var el = document.getElementById('status');
        if (el) {
            el.textContent = value;
        }
    }

    function formatText(template, vars) {
        var out = template || '';
        if (!vars) {
            return out;
        }
        var key;
        for (key in vars) {
            if (vars.hasOwnProperty(key)) {
                out = out.replace(new RegExp('\\{' + key + '\\}', 'g'), String(vars[key]));
            }
        }
        return out;
    }

    function getLanguagePack() {
        return I18N[currentLanguage] || I18N.da;
    }

    function getText(key, vars) {
        var pack = getLanguagePack();
        var text = (pack.ui && pack.ui[key]) || (I18N.da.ui && I18N.da.ui[key]) || '';
        return formatText(text, vars);
    }

    function getSpeech(key) {
        var pack = getLanguagePack();
        if (pack.speech && pack.speech[key]) {
            return pack.speech[key];
        }
        return I18N.da.speech[key] || '';
    }

    function getEmoteCopy(key) {
        var pack = getLanguagePack();
        if (pack.emotes && pack.emotes[key]) {
            return pack.emotes[key];
        }
        return I18N.da.emotes[key] || { label: key, description: key, speech: key };
    }

    function setTextById(id, text) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = text;
        }
    }

    function setAttrById(id, attrName, value) {
        var el = document.getElementById(id);
        if (el) {
            el.setAttribute(attrName, value);
        }
    }

    function setFlagSelection() {
        var buttons = document.getElementsByClassName('language-btn');
        var i;
        var lang;
        for (i = 0; i < buttons.length; i += 1) {
            lang = buttons[i].getAttribute('data-lang');
            if (lang === currentLanguage) {
                buttons[i].className = 'language-btn selected';
            } else {
                buttons[i].className = 'language-btn';
            }
        }
    }

    function applyLanguageToPage() {
        document.documentElement.lang = currentLanguage;

        setTextById('pageTitleIndex', getText('indexPageTitle'));
        setTextById('pageTitleEmotes', getText('emotesPageTitle'));
        setTextById('pageTitleTalk', getText('talkPageTitle'));
        setAttrById('languageSwitch', 'aria-label', getText('languageSelectorLabel'));
        setTextById('heroTitle', getText('heroTitle'));
        setTextById('btnSayHello', getText('btnSayHello'));
        setTextById('btnPlayGesture', getText('btnPlayGesture'));
        setTextById('btnPrutbanan', getText('btnPrutbanan'));
        setTextById('btnEmotes', getText('btnEmotes'));
        setTextById('volumeTitle', getText('volumeTitle'));
        setTextById('volumeHint', getText('volumeHint'));
        setTextById('volumeUnlock', getText('btnVolumeUnlock'));
        setTextById('volumeVoiceLabel', getText('volumeVoicePrefix'));
        setTextById('btnVolDown', getText('btnVolDown'));
        setTextById('btnVolUp', getText('btnVolUp'));
        setTextById('btnTestSound', getText('btnTestSound'));
        setTextById('btnHideVolume', getText('btnHideVolume'));
        setTextById('systemTitle', getText('systemTitle'));
        setTextById('btnStatus', getText('btnStatus'));
        setTextById('statusPlaceholder', getText('statusPlaceholder'));
        setTextById('emotesTitle', getText('emotesTitle'));
        setTextById('emotesSubtitle', getText('emotesSubtitle'));
        setTextById('talkTitle', getText('talkTitle'));
        setTextById('talkSubtitle', getText('talkSubtitle'));
        setTextById('recordButton', getText('talkRecordStart'));
        setTextById('anotherButton', getText('talkAnother'));
        setTextById('recordHint', getText('talkHintIdle'));
        setTextById('fallbackLabel', getText('talkFallbackLabel'));
        setAttrById('fallbackInterest', 'placeholder', getText('talkFallbackPlaceholder'));
        setTextById('recommendation', getText('talkRecommendationEmpty'));
        setTextById('bookStripTop', getText('talkBooksLoading'));
        setTextById('bookStripBottom', getText('talkBooksLoading'));
        setTextById('btnHome', getText('btnHome'));
        setTextById('btnEmotesNav', getText('btnEmotesNav'));
        setTextById('btnReloadPage', getText('btnReloadPage'));
        setTextById('footerCredit', getText('footerCredit'));

        var emoteIds = ['hello', 'bow', 'wave', 'thinking', 'come_on', 'show', 'happy', 'excited'];
        var i;
        var key;
        var copy;
        var img;
        for (i = 0; i < emoteIds.length; i += 1) {
            key = emoteIds[i];
            copy = getEmoteCopy(key);
            setTextById('emoteLabel-' + key, copy.label);
            setTextById('emoteDesc-' + key, copy.description);
            img = document.getElementById('emoteImg-' + key);
            if (img) {
                img.alt = copy.description;
            }
        }

        setFlagSelection();
    }

    function persistLanguage() {
        try {
            window.localStorage.setItem(STORAGE_KEY_LANGUAGE, currentLanguage);
        } catch (e) {
            // Ignorer hvis localStorage er utilgaengelig.
        }
    }

    function loadPersistedLanguage() {
        try {
            var raw = window.localStorage.getItem(STORAGE_KEY_LANGUAGE);
            if (raw === 'da' || raw === 'en' || raw === 'de') {
                currentLanguage = raw;
            }
        } catch (e) {
            currentLanguage = 'da';
        }
    }

    function clampVolume(value) {
        var n = parseInt(value, 10);
        if (isNaN(n)) {
            return 100;
        }
        if (n < 0) {
            return 0;
        }
        if (n > 100) {
            return 100;
        }
        return n;
    }

    function updateVolumeLabel() {
        var label = document.getElementById('volumeValue');
        if (label) {
            label.textContent = String(currentVolume) + '%';
        }
        var slider = document.getElementById('volumeSlider');
        if (slider) {
            slider.value = String(currentVolume);
        }
    }

    function loadPersistedVolume() {
        try {
            var raw = window.localStorage.getItem(STORAGE_KEY_VOLUME);
            if (raw !== null) {
                currentVolume = clampVolume(raw);
            }
        } catch (e) {
            currentVolume = 100;
        }
    }

    function persistVolume() {
        try {
            window.localStorage.setItem(STORAGE_KEY_VOLUME, String(currentVolume));
        } catch (e) {
            // Ignorer hvis localStorage er utilgaengelig.
        }
    }

    function setControlsVisibility(visible) {
        var controls = document.getElementById('volumeControls');
        if (!controls) {
            return;
        }
        isVolumeControlsVisible = visible;
        if (visible) {
            controls.className = 'volume-controls visible';
        } else {
            controls.className = 'volume-controls';
        }
    }

    function clearAutoHideTimer() {
        if (autoHideTimer) {
            clearTimeout(autoHideTimer);
            autoHideTimer = null;
        }
    }

    function scheduleAutoHide() {
        clearAutoHideTimer();
        autoHideTimer = setTimeout(function () {
            setControlsVisibility(false);
            setStatus(getText('statusControlsHiddenAuto'));
        }, 15000);
    }

    function unlockVolumeControls() {
        setControlsVisibility(true);
        updateVolumeLabel();
        scheduleAutoHide();
        setStatus(getText('statusControlsOpen'));
    }

    function startUnlockHold() {
        if (unlockHoldTimer || isVolumeControlsVisible) {
            return;
        }
        unlockHoldTimer = setTimeout(function () {
            unlockHoldTimer = null;
            unlockVolumeControls();
        }, 3000);
        setStatus(getText('statusHoldToOpen'));
    }

    function cancelUnlockHold() {
        if (!unlockHoldTimer) {
            return;
        }
        clearTimeout(unlockHoldTimer);
        unlockHoldTimer = null;
        setStatus(getText('statusHoldCancelled'));
    }

    function setupVolumeUnlockButton() {
        var unlockBtn = document.getElementById('volumeUnlock');
        if (!unlockBtn) {
            return;
        }

        unlockBtn.onmousedown = startUnlockHold;
        unlockBtn.onmouseup = cancelUnlockHold;
        unlockBtn.onmouseleave = cancelUnlockHold;
        unlockBtn.ontouchstart = function () {
            startUnlockHold();
            return false;
        };
        unlockBtn.ontouchend = function () {
            cancelUnlockHold();
            return false;
        };
        unlockBtn.ontouchcancel = function () {
            cancelUnlockHold();
            return false;
        };
    }

    function withVolumeMarkup(text) {
        var spokenText = text || '';
        var vol = clampVolume(currentVolume);
        return '\\vol=' + String(vol) + '\\' + spokenText + '\\rst\\';
    }
    
    function safeNavigate(path) {
        if (!path) {
            return;
        }
        window.location.href = path;
    }

    var BridgeApi = {
        // Send en kommando til /api/command (lokal proxy -> pepper-robot-bridge).
        // params kan udelades; statusbeskeder vises i #status.
        call: function (command, params) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/command', true);
            xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) {
                    return;
                }
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        setStatus(JSON.stringify(data, null, 2));
                    } catch (e) {
                        setStatus(getText('statusInvalidBridgeResponse', { response: xhr.responseText }));
                    }
                } else {
                    setStatus(getText('statusBridgeError', { status: xhr.status, response: xhr.responseText }));
                }
            };
            xhr.send(JSON.stringify({command: command, params: params || {}}));
            setStatus(getText('statusSending', { command: command }));
        }
    };

    var EmoteOptions = {
        hello: {gesture: 'hello'},
        bow: {gesture: 'bow'},
        wave: {gesture: 'hello'},
        thinking: {gesture: 'thinking'},
        come_on: {gesture: 'come_on'},
        show: {gesture: 'show'},
        happy: {gesture: 'happy'},
        excited: {gesture: 'excited'}
    };

    var Commands = {
        sayHello: function () {
            BridgeApi.call('say', {text: withVolumeMarkup(getSpeech('hello'))});
        },
        // Techtonic / bar mode quick jokes (restores Techtonic UI handlers)
        sayTechtonicRobotJoke: function () {
            BridgeApi.call('say', {text: withVolumeMarkup('Hvorfor sagde robotten hej? Fordi den huskede at hilse!')});
        },
        sayTechtonicBarJoke: function () {
            BridgeApi.call('say', {text: withVolumeMarkup('Bartenderen sagde: Vi serverer ikke bytes her, kun drinks.')});
        },
        sayTechtonicFusionJoke: function () {
            BridgeApi.call('say', {text: withVolumeMarkup('En robot gik ind i en bar og bestilte en opladning.')});
        },
        sayPrutbanan: function () {
            BridgeApi.call('say', {text: withVolumeMarkup(getSpeech('prutbanan'))});
        },
        playGesture: function () {
            BridgeApi.call('play_gesture', {gesture_name: 'hello'});
        },
        hideTablet: function () {
            BridgeApi.call('hide_tablet', {});
        },
        getStatus: function () {
            BridgeApi.call('get_status', {});
        },
        sayText: function () {
            var input = document.getElementById('customText');
            BridgeApi.call('say', {text: withVolumeMarkup((input && input.value) || 'Hello')});
        },
        setVolume: function (value) {
            currentVolume = clampVolume(value);
            persistVolume();
            updateVolumeLabel();
            if (isVolumeControlsVisible) {
                scheduleAutoHide();
            }
            setStatus(getText('statusVolumeSet', { value: String(currentVolume) }));
        },
        increaseVolume: function () {
            Commands.setVolume(currentVolume + 10);
        },
        decreaseVolume: function () {
            Commands.setVolume(currentVolume - 10);
        },
        sayVolumeSample: function () {
            if (isVolumeControlsVisible) {
                scheduleAutoHide();
            }
            BridgeApi.call('say', {text: withVolumeMarkup(getSpeech('volumeSample'))});
        },
        lockVolumeControls: function () {
            clearAutoHideTimer();
            setControlsVisibility(false);
            setStatus(getText('statusControlsHidden'));
        },
        runEmote: function (key) {
            var option = EmoteOptions[key];
            var emoteCopy = getEmoteCopy(key);
            if (!option) {
                setStatus(getText('statusUnknownEmote', { key: key }));
                return;
            }

            BridgeApi.call('say', {text: withVolumeMarkup(emoteCopy.speech)});
            BridgeApi.call('play_gesture', {gesture_name: option.gesture});
            setStatus(getText('statusRunningEmote', { label: emoteCopy.label }));
        },
        setLanguage: function (lang) {
            if (lang !== 'da' && lang !== 'en' && lang !== 'de') {
                return;
            }
            currentLanguage = lang;
            persistLanguage();
            applyLanguageToPage();
            if (window.TalkPage && typeof window.TalkPage.onLanguageChanged === 'function') {
                window.TalkPage.onLanguageChanged();
            }
            setStatus(getText('statusLanguageChanged'));
        },
        goHome: function () {
            safeNavigate('index.html');
        },
        goEmotes: function () {
            safeNavigate('emotes.html');
        },
        goTalk: function () {
            safeNavigate('talk.html');
        },
        reloadPage: function () {
            window.location.reload(true);
        }
    };

    loadPersistedLanguage();
    applyLanguageToPage();
    loadPersistedVolume();
    updateVolumeLabel();
    setupVolumeUnlockButton();
    setControlsVisibility(false);

    // Bind ITK banner (brand-banner) as a quick link to Techtonic Bar mode
    // This avoids editing HTML and restores access via the logo/banner.
    (function bindBrandBanner() {
        try {
            var banner = document.querySelector('.brand-banner');
            if (banner) {
                banner.style.cursor = 'pointer';
                banner.addEventListener('click', function () {
                    safeNavigate('techtonic.html');
                });
            }
        } catch (e) {
            // no-op
        }
    }());

    // Eksponer for inline onclick-attributter i index.html.
    window.Commands = Commands;
    window.BridgeApi = BridgeApi;
    window.NormaI18n = {
        getLanguage: function () {
            return currentLanguage;
        },
        getText: getText
    };
})();
