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
    var currentVolume = 100;
    var unlockHoldTimer = null;
    var autoHideTimer = null;
    var isVolumeControlsVisible = false;

    function setStatus(value) {
        var el = document.getElementById('status');
        if (el) {
            el.textContent = value;
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
            setStatus('Lydkontrol skjult. Hold knappen nede igen for at aabne.');
        }, 15000);
    }

    function unlockVolumeControls() {
        setControlsVisibility(true);
        updateVolumeLabel();
        scheduleAutoHide();
        setStatus('Lydkontrol aabnet i 15 sekunder.');
    }

    function startUnlockHold() {
        if (unlockHoldTimer || isVolumeControlsVisible) {
            return;
        }
        unlockHoldTimer = setTimeout(function () {
            unlockHoldTimer = null;
            unlockVolumeControls();
        }, 3000);
        setStatus('Holder... lydkontrol aabner om 3 sekunder.');
    }

    function cancelUnlockHold() {
        if (!unlockHoldTimer) {
            return;
        }
        clearTimeout(unlockHoldTimer);
        unlockHoldTimer = null;
        setStatus('Hold afbrudt.');
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
                        setStatus('Ugyldigt svar fra bridge: ' + xhr.responseText);
                    }
                } else {
                    setStatus('Fejl ' + xhr.status + ': ' + xhr.responseText);
                }
            };
            xhr.send(JSON.stringify({command: command, params: params || {}}));
            setStatus('Sender ' + command + '...');
        }
    };

    var EmoteOptions = {
        hello: {label: 'Hej', gesture: 'hello', speech: 'Hej, jeg er her.'},
        bow: {label: 'Buk', gesture: 'bow', speech: 'Jeg bukker mig.'},
        wave: {label: 'Vink', gesture: 'wave', speech: 'Jeg vinker.'},
        thinking: {label: 'Tænk', gesture: 'thinking', speech: 'Jeg tænker nu.'},
        come_on: {label: 'Kom med', gesture: 'come_on', speech: 'Kom med mig.'},
        show: {label: 'Vis', gesture: 'show', speech: 'Jeg viser det her.'},
        happy: {label: 'Glad', gesture: 'happy', speech: 'Jeg er glad.'},
        excited: {label: 'Spændt', gesture: 'excited', speech: 'Jeg er spændt.'}
    };

    var Commands = {
        sayHello: function () {
            BridgeApi.call('say', {text: withVolumeMarkup('Hello')});
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
            setStatus('Lydniveau sat til ' + String(currentVolume) + '%. Tryk "Test lyd" for at hoere det.');
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
            BridgeApi.call('say', {text: withVolumeMarkup('Det her er mit aktuelle lydniveau.')});
        },
        lockVolumeControls: function () {
            clearAutoHideTimer();
            setControlsVisibility(false);
            setStatus('Lydkontrol skjult.');
        },
        runEmote: function (key) {
            var option = EmoteOptions[key];
            if (!option) {
                setStatus('Ukendt emote: ' + key);
                return;
            }

            BridgeApi.call('say', {text: withVolumeMarkup(option.speech)});
            BridgeApi.call('play_gesture', {gesture_name: option.gesture});
            setStatus('Kører emote: ' + option.label);
        }
    };

    loadPersistedVolume();
    updateVolumeLabel();
    setupVolumeUnlockButton();
    setControlsVisibility(false);

    // Eksponer for inline onclick-attributter i index.html.
    window.Commands = Commands;
    window.BridgeApi = BridgeApi;
})();
