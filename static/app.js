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

    function setStatus(value) {
        var el = document.getElementById('status');
        if (el) {
            el.textContent = value;
        }
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

    var Commands = {
        sayHello: function () {
            BridgeApi.call('say', {text: 'Hello'});
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
            BridgeApi.call('say', {text: (input && input.value) || 'Hello'});
        }
    };

    // Eksponer for inline onclick-attributter i index.html.
    window.Commands = Commands;
    window.BridgeApi = BridgeApi;
})();
