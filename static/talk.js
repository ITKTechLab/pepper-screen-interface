(function () {
    'use strict';

    var recording = false;
    var autoReturnTimer = null;
    var AUTO_RETURN_MS = 30000;
    var alreadySuggestedIds = [];
    var lastInterestText = '';
    var i18n = window.NormaI18n || null;

    function t(key, vars) {
        if (i18n && typeof i18n.getText === 'function') {
            return i18n.getText(key, vars);
        }
        return key;
    }

    function el(id) {
        return document.getElementById(id);
    }

    function setRecommendationText(text) {
        var box = el('recommendation');
        if (box) {
            box.textContent = text;
        }
    }

    function scheduleAutoReturn() {
        if (autoReturnTimer) {
            clearTimeout(autoReturnTimer);
        }
        autoReturnTimer = setTimeout(function () {
            window.location.href = 'index.html';
        }, AUTO_RETURN_MS);
    }

    function setRecordingUi(active) {
        var icon = el('recordIcon');
        var button = el('recordButton');
        var hint = el('recordHint');

        if (icon) {
            icon.className = active ? 'record-icon recording' : 'record-icon';
        }
        if (button) {
            button.textContent = active ? t('talkRecordStop') : t('talkRecordStart');
        }
        if (hint) {
            hint.textContent = active
                ? t('talkHintRecording')
                : t('talkHintIdle');
        }
    }

    function normalizeInterest(text) {
        var clean = (text || '').replace(/^\s+|\s+$/g, '');
        if (!clean) {
            clean = t('talkDefaultInterest');
        }
        return clean;
    }

    function askRecommendation(interestText, recommendAnother) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/book-recommendation', true);
        xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');

        setRecommendationText(t('talkWorkingRecommendation'));

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }

            if (xhr.status < 200 || xhr.status >= 300) {
                setRecommendationText(t('talkRecommendationError', { status: xhr.status }));
                return;
            }

            try {
                var data = JSON.parse(xhr.responseText);
                if (data.status !== 'ok') {
                    setRecommendationText(t('talkRecommendationUnavailable'));
                    return;
                }

                var book = data.book || {};
                var lines = [];
                lines.push(t('talkRecommendationTitleLine', { title: (book.title || t('talkUnknownTitle')) }));
                lines.push(t('talkRecommendationAuthorLine', { author: (book.author || t('talkUnknownAuthor')) }));
                if (book.short_pitch) {
                    lines.push(t('talkRecommendationWhyLine', { reason: book.short_pitch }));
                }
                if (data.match_reason) {
                    lines.push(data.match_reason);
                }
                if (data.engine) {
                    lines.push(t('talkEngineLine', { engine: data.engine }));
                }
                lines.push(t('talkRecommendationNormaLine', { reply: (data.spoken_reply || t('talkRecommendationMoreLine')) }));
                setRecommendationText(lines.join('\n'));

                if (book.id) {
                    alreadySuggestedIds.push(String(book.id));
                    if (alreadySuggestedIds.length > 25) {
                        alreadySuggestedIds = alreadySuggestedIds.slice(alreadySuggestedIds.length - 25);
                    }
                }

                if (window.BridgeApi && window.BridgeApi.call && data.spoken_reply) {
                    window.BridgeApi.call('say', { text: data.spoken_reply });
                }

                scheduleAutoReturn();
            } catch (e) {
                setRecommendationText(t('talkInvalidRecommendationResponse'));
            }
        };

        xhr.send(JSON.stringify({
            interest: interestText,
            exclude_ids: recommendAnother ? alreadySuggestedIds : []
        }));
    }

    function transcribeThenRecommend(interestText, recommendAnother) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/transcribe', true);
        xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
        setRecommendationText(t('talkPreparingTranscript'));

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }

            if (xhr.status < 200 || xhr.status >= 300) {
                setRecommendationText(t('talkTranscriptError', { status: xhr.status }));
                return;
            }

            try {
                var data = JSON.parse(xhr.responseText);
                if (data.status !== 'ok') {
                    setRecommendationText(t('talkTranscriptError', { status: (data.message || t('talkTranscriptUnknownError')) }));
                    return;
                }

                var transcript = normalizeInterest(data.transcript || interestText);
                lastInterestText = transcript;
                askRecommendation(transcript, recommendAnother);
            } catch (e) {
                setRecommendationText(t('talkInvalidTranscriptResponse'));
            }
        };

        // Indtil mikrofon er koblet på, sender vi tekst som dev-input.
        xhr.send(JSON.stringify({ text: interestText }));
    }

    function buildStripText(books) {
        if (!books || !books.length) {
            return t('talkBooksPending');
        }

        var parts = [];
        var i;
        for (i = 0; i < books.length; i += 1) {
            parts.push(t('talkBookStripItem', {
                title: books[i].title,
                author: books[i].author
            }));
        }
        return parts.join('  •  ') + '  •  ' + parts.join('  •  ');
    }

    function loadBookStrips() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/books.json', true);
        xhr.onreadystatechange = function () {
            var top = el('bookStripTop');
            var bottom = el('bookStripBottom');
            if (xhr.readyState !== 4) {
                return;
            }
            if (xhr.status < 200 || xhr.status >= 300) {
                return;
            }

            try {
                var books = JSON.parse(xhr.responseText);
                var stripText = buildStripText(books);
                if (top) {
                    top.textContent = stripText;
                }
                if (bottom) {
                    bottom.textContent = stripText;
                }
            } catch (e) {
                // Ignorer ved parse-fejl.
            }
        };
        xhr.send();
    }

    var TalkPage = {
        toggleRecording: function () {
            recording = !recording;
            setRecordingUi(recording);

            if (recording) {
                setRecommendationText(t('talkReadyForInput'));
                if (autoReturnTimer) {
                    clearTimeout(autoReturnTimer);
                    autoReturnTimer = null;
                }
                return;
            }

            var input = el('fallbackInterest');
            var interest = normalizeInterest(input ? input.value : '');
            transcribeThenRecommend(interest, false);
        },
        askAnother: function () {
            var interest = normalizeInterest(lastInterestText || (el('fallbackInterest') ? el('fallbackInterest').value : ''));
            transcribeThenRecommend(interest, true);
        },
        onLanguageChanged: function () {
            setRecordingUi(recording);
        }
    };

    loadBookStrips();
    setRecordingUi(false);

    window.TalkPage = TalkPage;
})();
