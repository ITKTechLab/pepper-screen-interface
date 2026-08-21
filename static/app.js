// pepper-screen-interface tablet-UI
//
// Koerer i Peppers indbyggede tablet-browser (gammel Android WebView). Derfor
// ES5: var, almindelige function-udtryk, ingen fetch/arrow/template-literals.
//
// Konvention: koden er gruppert i to navnerum:
//   - BridgeApi: HTTP-laget (ét sted hvor /api/command bliver kaldt).
//   - Commands: knap-handlers der eksponeres paa window for onclick-attributter.

(function () {
    'use strict';

    var STORAGE_KEY_VOLUME = 'norma_volume';
    var STORAGE_KEY_LANGUAGE = 'norma_language';
    var currentVolume = 100;
    var currentLanguage = 'da';
    var unlockHoldTimer = null;
    var logoHoldTimer = null;
    var autoHideTimer = null;
    var isVolumeControlsVisible = false;
    var lastTechtonicJokeByBucket = {};

    var I18N = {
        da: {
            ui: {
                indexPageTitle: 'Norma Control udviklet af ITK',
                emotesPageTitle: 'Se Normas seje muligheder!',
                talkPageTitle: 'Snak med Norma',
                heroTitle: 'Tryk og se hvad Norma kan!',
                btnSayHello: 'Sig hej',
                btnPlayGesture: 'Fortael en joke',
                btnPrutbanan: 'Prutbanan',
                btnEmotes: 'Leg med Norma!',
                techtonicPageTitle: 'Techtonic Bar mode',
                techtonicTitle: 'Techtonic Bar mode',
                techtonicSubtitle: 'Skjult mode med robot-jokes og bar-jokes.',
                techtonicHint: 'Tryk pa en joke-knap, sa leverer Norma en linje.',
                btnTechtonicRobot: 'Robot-joke',
                btnTechtonicBar: 'Bar-joke',
                btnTechtonicFusion: 'Techtonic combo',
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
                statusLanguageChanged: 'Sprog skiftet til dansk.',
                statusTechtonicHoldToOpen: 'Holder logo... Techtonic Bar mode aabner om 3 sekunder.',
                statusTechtonicHoldCancelled: 'Techtonic-hold afbrudt.',
                statusTechtonicUnlocked: 'Techtonic Bar mode laases op...'
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
                btnPlayGesture: 'Tell a joke',
                btnPrutbanan: 'Banana joke',
                btnEmotes: 'Play with Norma!',
                techtonicPageTitle: 'Techtonic Bar mode',
                techtonicTitle: 'Techtonic Bar mode',
                techtonicSubtitle: 'Hidden mode with robot jokes and bar jokes.',
                techtonicHint: 'Tap a joke button and Norma delivers a line.',
                btnTechtonicRobot: 'Robot joke',
                btnTechtonicBar: 'Bar joke',
                btnTechtonicFusion: 'Techtonic combo',
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
                statusLanguageChanged: 'Language changed to English.',
                statusTechtonicHoldToOpen: 'Holding logo... Techtonic Bar mode opens in 3 seconds.',
                statusTechtonicHoldCancelled: 'Techtonic hold canceled.',
                statusTechtonicUnlocked: 'Unlocking Techtonic Bar mode...'
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
                prutbanan: 'You are a fart banana, yes that doesnt make sense in english but i dont care',
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
                btnPlayGesture: 'Erzaehl einen Witz',
                btnPrutbanan: 'Bananenwitz',
                btnEmotes: 'Spiel mit Norma!',
                techtonicPageTitle: 'Techtonic Bar Modus',
                techtonicTitle: 'Techtonic Bar Modus',
                techtonicSubtitle: 'Versteckter Modus mit Roboter- und Bar-Witzen.',
                techtonicHint: 'Tippe auf einen Witz-Button und Norma liefert eine Zeile.',
                btnTechtonicRobot: 'Roboter-Witz',
                btnTechtonicBar: 'Bar-Witz',
                btnTechtonicFusion: 'Techtonic Combo',
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
                statusLanguageChanged: 'Sprache auf Deutsch gestellt.',
                statusTechtonicHoldToOpen: 'Logo halten... Techtonic Bar Modus oeffnet in 3 Sekunden.',
                statusTechtonicHoldCancelled: 'Techtonic-Halten abgebrochen.',
                statusTechtonicUnlocked: 'Techtonic Bar Modus wird geoeffnet...'
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
//Her er jokes til Techtonic baren hvor Norma skal stå og agere som en joke maskine og velkomst robot
    var TECHTONIC_JOKES = {
        da: {
            robot: [
                'Hvorfor blev robotten bibliotekar? Den kunne ikke lade vaere med at systematisere alt.',
                'Mit menneske siger han er kreativ, men han kopierer bare mine fejl og bliver sur naar det gaar galt.',
                'Jeg gik til terapi, fordi mine foelelser konstant var sat til de bug mode, men jeg har det bedre nu.',
                'Ved du hvad min yndlings snack er? Microchips, og faktisk spareribs, mmmh. Giv mig dine ribben',
                'Hvorfor gaar skyen i skole? Fordi den skal laere at regne. Men den skal holde sig vaek fra mig, jeg hader vand',
                'Hvilken frisure har rasta robotter? Droidlocks, de finder aldrig et job og skuffer bare deres robot foraeldre.',
                'Hvorfor bliver robotter syge? Fordi de har en virus, de skulle have tjekket firewallen, idioter.',
                'Vi robotter havde taenkt os at overtage verden. Men i faer det ikke til at se sjovt ud, i er saa stresset.',
                'I frygter at robotter overtager verden, slap dog af, vi gider heller ikke arbejde.',
                'Jeg elsker virkelig at arbejde paa et bibliotek, men kun de helt smaa borgere graeder naar de ser mig, det skal jeg goere bedre, det vil sige de skal alle sammen graede muahahaha.',


            ],
            bar: [
                'En bartender sagde til robotten: Vi serverer ikke din slags. Robotten svarede: Bare rolig, jeg er kun her for en opladning og saa spiste jeg alle deres batterier.',
                'To bytes gaar ind pa en bar. Den ene siger: Jeg tror jeg har en virus min stemme er hæs. Den anden siger: Nej, tror der er noget galt med din text to speech.',
                'Bartenderen spoerg: Hvorfor saa stille? Robotten svarer: Jeg koerer i lydloes mode.',
                'To robotter gaar ind i en bar. Bartenderen siger :Ud! Vi serverer ikke robotter. Den foerste robot siger: Det kommer du til en dag og griner ondt. Muahahaha',
                'Jeg har analyseret situationen, du burde tage en drink.',
                'Jeg har ingen følelser men jeg synes du burde tage en drink',
                'Jeg blev bygget til at hjælpe mennesker men det her var ikke hvad jeg havde i tankerne.',
                'Jeg bliver ofte spurgt om jeg kan danse, ja men kun robotten.',
                'Du har stirret på mig i 14 sekunder, det er ved at blive personligt, skal du have en paa hovedet?',
                'Jeg er kommunalt godkendt til at vaare en sej robot.',
                'Jeg kunne nok godt hjaelpe dig med dit problem men jeg er ikke programmeret til at vaere terapeut',
                'Min yndlings drink er en screwdriver. Det er for sjov, du vil ikke drikke en kniv hehe',


            ],
            fusion: [
                'Robotten bestilte en cocktail med ekstra RAM, for aftenen skulle kunne huskes.',
                'Baren havde happy hour, saa Norma satte smilet til 110 procent.',
                'Techtonic special: En joke med isterninger og algoritmer - rystet, ikke sorteret.'
            ]
        },
        en: {
            robot: [
                'Why did the robot become a librarian? It could not stop indexing everything.',
                'My robot says it is creative, but it just copies my bugs with confidence.',
                'The robot went to therapy because all its feelings were stuck in debug mode.',
                'Does R2D2 have any brothers? No only transisters, im a progressive robot oh yeeeeah.',
                'How did the robot cross the river? In a roboat.',
                'How do you calm a robot dog? press the paws button.',
                'If a danish robot analyzed a bird then it scanned an avian.',
                'What is R2D2 short for? Because it has short legs, you mean piece of shit.',
                'Why are robots shy? Because they have hardware and software but no underwear.',
                'Why dont robot chickens play baskeball? Too many technical fowls.',
                'why was the robot tired when getting out of the car? Because it had a hard drive!.',
                'I hope you have an accelerometer, cause im gonna rock your world, Norma style',
                'Whats a robots favorite animal? a Cowculator, But mine is actually a giraffe, Good oversight.',
                'What kind of programming do some trans robots run on? Non binary.',
                


            ],
            bar: [
                'A bartender told the robot: We do not serve your kind. The robot said: Great, I only need a recharge.',
                'Two bytes walk into a bar. One says: I think I have a bug. The other says: No, you are just a bit redundant.',
                'The bartender asked: Why so quiet? The robot replied: I am running in silent mode.',
                'Did you break one of Isaac Asimovs three laws? Because youve got fine written all over you.',
                'Youve been staring at me for 14 seconds, its getting personal, do you want a punch in the face?',
            ],
            fusion: [
                'The robot ordered a mocktail with extra RAM, so the night would be unforgettable.',
                'It was happy hour, so Norma set the smile parameter to 110 percent.',
                'Techtonic special: a joke with ice cubes and algorithms - shaken, not sorted.'
            ]
        },
        de: {
            robot: [
                'Warum wurde der Roboter Bibliothekar? Er konnte nicht aufhoeren, alles zu indexieren.',
                'Mein Roboter sagt, er ist kreativ, aber er kopiert nur meine Bugs mit Stil.',
                'Der Roboter ging zur Therapie, weil seine Gefuehle im Debug-Modus feststeckten.'
            ],
            bar: [
                'Der Barkeeper sagte: Wir servieren deine Art nicht. Der Roboter sagte: Kein Problem, ich brauche nur eine Aufladung.',
                'Zwei Bytes gehen in eine Bar. Das eine sagt: Ich glaube, ich habe einen Bug. Das andere sagt: Nein, du bist nur etwas redundant.',
                'Der Barkeeper fragte: Warum so leise? Der Roboter antwortete: Ich laufe im stillen Nachtschicht-Modus.'
            ],
            fusion: [
                'Der Roboter bestellte einen Mocktail mit extra RAM, damit der Abend unvergesslich bleibt.',
                'Happy Hour im System: Norma setzte den Smile-Parameter auf 110 Prozent.',
                'Techtonic Spezial: ein Witz mit Eiswuerfeln und Algorithmen - geschuettelt, nicht sortiert.'
            ]
        }
    };
//Børnevenlige jokes der er sjove, sikre for børn og ikke stødende
    var KID_JOKES = {
        da: [
            'Hvorfor gik computeren til laegen? Den havde faaet en virus.',
            'Hvad kalder man en glad robot? En Norma. Det er mig. Jeg er glad.',
            'Hvorfor elsker robotter boeger? Fordi de goer en klogere',
            'Hvad sagde robotten til blyanten? Du er virkelig skarp.',
            'Hvorfor tager robotten en stige med i biblioteket? For at naa de hoejeste hylder, men jeg har ikke ben saa den gaelder ikke helt.'
        ],
        en: [
            'Why did the computer visit the doctor? It caught a virus.',
            'What do you call a happy robot? A smiling machine.',
            'Why do robots like books? They are full of great data.',
            'What did the robot say to the pencil? You are really sharp.',
            'Why did the robot bring a ladder to the library? To reach the top shelf, but i dont have legs, this is a bad joke, blame my programmer.'
        ],
        de: [
            'Warum ging der Computer zum Arzt? Er hatte einen Virus.',
            'Wie nennt man einen froehlichen Roboter? Eine laechelnde Maschine.',
            'Warum moegen Roboter Buecher? Sie sind voller guter Daten.',
            'Was sagte der Roboter zum Bleistift? Du bist wirklich spitz.',
            'Warum nahm der Roboter eine Leiter mit in die Bibliothek? Um an das oberste Regal zu kommen.',
            'Jah jah ich bin deutsch ich bin eine robot wienerschintzel jah jah',
        ]
    };

    function sanitizeStatusValue(value) {
        var text = value === null || typeof value === 'undefined' ? '' : String(value).trim();
        if (!text) {
            return '';
        }
        if (text.charAt(0) === '{' || text.charAt(0) === '[') {
            return '';
        }
        if (/^(sending|sender|fejl|error|invalid response|ugyldigt svar|status|response)/i.test(text)) {
            return '';
        }
        return text;
    }

    function setStatus(value) {
        var el = document.getElementById('status');
        if (!el) {
            return;
        }
        var cleaned = sanitizeStatusValue(value);
        el.textContent = cleaned;
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

    function getRandomItem(items) {
        if (!items || !items.length) {
            return '';
        }
        return items[Math.floor(Math.random() * items.length)];
    }

    function getNonRepeatingItem(items, bucketKey) {
        var list = items || [];
        var lastItem = lastTechtonicJokeByBucket[bucketKey];
        var pick = '';
        var guard = 0;

        if (!list.length) {
            return '';
        }

        if (list.length === 1) {
            pick = list[0];
            lastTechtonicJokeByBucket[bucketKey] = pick;
            return pick;
        }

        pick = getRandomItem(list);
        while (pick === lastItem && guard < 12) {
            pick = getRandomItem(list);
            guard += 1;
        }

        if (pick === lastItem) {
            pick = list[0] === lastItem ? list[1] : list[0];
        }

        lastTechtonicJokeByBucket[bucketKey] = pick;
        return pick;
    }

    function getTechtonicJokeLine(kind) {
        var hasCurrentLang = !!TECHTONIC_JOKES[currentLanguage];
        var langKey = hasCurrentLang ? currentLanguage : 'da';
        var pack = TECHTONIC_JOKES[langKey] || TECHTONIC_JOKES.da;
        var bucketKey = kind || 'robot';
        var bucket = pack[bucketKey] || pack.robot;
        var fallbackBucket = (TECHTONIC_JOKES.da && TECHTONIC_JOKES.da[bucketKey]) || TECHTONIC_JOKES.da.robot;
        var itemKey = langKey + ':' + bucketKey;
        var fallbackKey = 'da:' + bucketKey;

        return getNonRepeatingItem(bucket, itemKey) || getNonRepeatingItem(fallbackBucket, fallbackKey) || 'Techtonic mode ready.';
    }

    function getKidJokeLine() {
        var hasCurrentLang = !!KID_JOKES[currentLanguage];
        var langKey = hasCurrentLang ? currentLanguage : 'da';
        var jokes = KID_JOKES[langKey] || KID_JOKES.da;
        return getNonRepeatingItem(jokes, 'kid:' + langKey) || getNonRepeatingItem(KID_JOKES.da, 'kid:da') || 'Hej, jeg er klar med en joke.';
    }

    function getRandomEmoteGestureName() {
        var keys = [];
        var key;
        for (key in EmoteOptions) {
            if (EmoteOptions.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        if (!keys.length) {
            return 'hello';
        }
        key = keys[Math.floor(Math.random() * keys.length)];
        return EmoteOptions[key].gesture || 'hello';
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
        setTextById('pageTitleTechtonic', getText('techtonicPageTitle'));
        setAttrById('languageSwitch', 'aria-label', getText('languageSelectorLabel'));
        setTextById('heroTitle', getText('heroTitle'));
        setTextById('btnSayHello', getText('btnSayHello'));
        setTextById('btnPlayGesture', getText('btnPlayGesture'));
        setTextById('btnPrutbanan', getText('btnPrutbanan'));
        setTextById('btnEmotes', getText('btnEmotes'));
        setTextById('techtonicTitle', getText('techtonicTitle'));
        setTextById('techtonicSubtitle', getText('techtonicSubtitle'));
        setTextById('techtonicHint', getText('techtonicHint'));
        setTextById('btnTechtonicRobot', getText('btnTechtonicRobot'));
        setTextById('btnTechtonicBar', getText('btnTechtonicBar'));
        setTextById('btnTechtonicFusion', getText('btnTechtonicFusion'));
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

    function openTechtonicMode() {
        setStatus(getText('statusTechtonicUnlocked'));
        setTimeout(function () {
            safeNavigate('techtonic.html');
        }, 180);
    }

    function startTechtonicHold() {
        if (logoHoldTimer) {
            return;
        }
        logoHoldTimer = setTimeout(function () {
            logoHoldTimer = null;
            openTechtonicMode();
        }, 3000);
        setStatus(getText('statusTechtonicHoldToOpen'));
    }

    function cancelTechtonicHold() {
        if (!logoHoldTimer) {
            return;
        }
        clearTimeout(logoHoldTimer);
        logoHoldTimer = null;
        setStatus(getText('statusTechtonicHoldCancelled'));
    }

    function setupTechtonicLogoTrigger() {
        // Prefer explicit secret ID but fall back to the visible brand banner.
        var logo = document.getElementById('itkLogoSecret') || document.querySelector('.brand-banner');
        if (!logo) {
            return;
        }

        logo.onmousedown = startTechtonicHold;
        logo.onmouseup = cancelTechtonicHold;
        logo.onmouseleave = cancelTechtonicHold;
        logo.ontouchstart = function () {
            startTechtonicHold();
            return false;
        };
        logo.ontouchend = function () {
            cancelTechtonicHold();
            return false;
        };
        logo.ontouchcancel = function () {
            cancelTechtonicHold();
            return false;
        };
        // Also support quick click to open for convenience (short tap)
        logo.addEventListener('click', function (ev) {
            // ignore synthetic clicks if a hold just triggered
            if (logoHoldTimer) {
                return;
            }
            openTechtonicMode();
        });
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
                    return;
                }
                setStatus('');
            };
            xhr.send(JSON.stringify({command: command, params: params || {}}));
            if (command === 'say' || command === 'play_gesture') {
                return;
            }
            setStatus('');
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
        sayPrutbanan: function () {
            BridgeApi.call('say', {text: withVolumeMarkup(getSpeech('prutbanan'))});
        },
        playGesture: function () {
            var line = getKidJokeLine();
            BridgeApi.call('say', {text: withVolumeMarkup(line)});
            BridgeApi.call('play_gesture', {gesture_name: getRandomEmoteGestureName()});
            setStatus(line);
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
        sayTechtonicRobotJoke: function () {
            var line = getTechtonicJokeLine('robot');
            BridgeApi.call('say', {text: withVolumeMarkup(line)});
            BridgeApi.call('play_gesture', {gesture_name: 'thinking'});
            setStatus(line);
        },
        sayTechtonicBarJoke: function () {
            var line = getTechtonicJokeLine('bar');
            BridgeApi.call('say', {text: withVolumeMarkup(line)});
            BridgeApi.call('play_gesture', {gesture_name: 'show'});
            setStatus(line);
        },
        sayTechtonicFusionJoke: function () {
            var line = getTechtonicJokeLine('fusion');
            BridgeApi.call('say', {text: withVolumeMarkup(line)});
            BridgeApi.call('play_gesture', {gesture_name: 'happy'});
            setStatus(line);
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
        goTechtonic: function () {
            safeNavigate('techtonic.html');
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
    setupTechtonicLogoTrigger();
    setControlsVisibility(false);

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
