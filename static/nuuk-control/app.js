(function () {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, text) {
        var el = byId(id);
        if (el) {
            el.textContent = text;
        }
    }

    function setStatusClass(id, value) {
        var el = byId(id);
        if (!el) {
            return;
        }
        var low = String(value || '').toLowerCase();
        el.className = 'status-value';
        if (low.indexOf('ok') !== -1 || low.indexOf('koerer') !== -1) {
            el.className += ' status-ok';
        } else if (low.indexOf('fejl') !== -1 || low.indexOf('stoppet') !== -1) {
            el.className += ' status-error';
        } else {
            el.className += ' status-warn';
        }
    }

    function appendLog(text) {
        var el = byId('logOutput');
        if (!el) {
            return;
        }
        el.textContent += '\n' + text;
        el.scrollTop = el.scrollHeight;
    }

    function renderStatus(payload) {
        var parsed = payload.parsed || {};
        setText('runnerValue', parsed.runner || 'Ukendt');
        setStatusClass('runnerValue', parsed.runner || '');
        setText('bridgeValue', parsed.bridge || 'Ukendt');
        setStatusClass('bridgeValue', parsed.bridge || '');
        setText('robotValue', parsed.robot || 'Ukendt');
        setStatusClass('robotValue', parsed.robot || '');
        setText('screenValue', parsed.screen || 'Ukendt');
        setStatusClass('screenValue', parsed.screen || '');
        setText('nextStep', payload.next_step || 'Ingen vejledning endnu.');
        setText('tabletUrl', 'Tablet URL: ' + (parsed.tablet_url || 'ukendt'));
    }

    function fetchStatus() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/status', true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                var payload = JSON.parse(xhr.responseText);
                renderStatus(payload);
            } else {
                appendLog('Kunne ikke hente status: ' + xhr.status + ' ' + xhr.responseText);
            }
        };
        xhr.send(null);
    }

    function runAction(action) {
        appendLog('>>> Kører: ' + action);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/action', true);
        xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                var payload = JSON.parse(xhr.responseText);
                renderStatus(payload);
                if (payload.command_output) {
                    appendLog(payload.command_output);
                }
            } else {
                appendLog('Handling fejlede: ' + xhr.status + ' ' + xhr.responseText);
            }
        };
        xhr.send(JSON.stringify({action: action}));
    }

    function bindButtons() {
        var buttons = document.querySelectorAll('[data-action]');
        var i;
        for (i = 0; i < buttons.length; i += 1) {
            buttons[i].onclick = function () {
                runAction(this.getAttribute('data-action'));
            };
        }
    }

    bindButtons();
    fetchStatus();
    window.setInterval(fetchStatus, 8000);
})();
