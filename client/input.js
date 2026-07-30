/*
    DiepCustom - custom tank game server that shares diep.io's WebSocket protocol
    Copyright (C) 2022 ABCxFF (github.com/ABCxFF)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>
*/

window.setupInput = () => {
    window.input = {
        mouse: Module.exports.mouse,
        keyDown: Module.exports.keyDown,
        keyUp: Module.exports.keyUp,
        blur: Module.exports.resetKeys,
        wheel: Module.exports.mouseWheel,
        prevent_right_click: Module.exports.preventRightClick,
        flushInputHooks: Module.exports.flushInputHooks,
        print_convar_help: Module.exports.printConsoleHelp,
        should_prevent_unload: Module.exports.hasTank,
        get_convar: key => {
            const keyPtr = Module.allocateUTF8(key.toString());
            const res = Module.exports.getConvar(keyPtr);
            Module.exports.free(keyPtr);
            return res ? Module.UTF8ToString(res) : null;
        },
        set_convar: (key, val) => {
            const keyPtr = Module.allocateUTF8(key.toString());
            const valPtr = Module.allocateUTF8(val.toString());
            const res = Boolean(Module.exports.setConvar(keyPtr, valPtr));
            Module.exports.free(keyPtr);
            Module.exports.free(valPtr);
            return res;
        },
        execute: cmd => {
            const cmdPtr = Module.allocateUTF8(cmd.toString());
            Module.exports.execute(cmdPtr);
            Module.exports.free(cmdPtr);
        }
    };

    const onMouseWheel = e => window.input.wheel(e.wheelDelta / -120);

    /firefox/i.test(navigator.userAgent) ? document.addEventListener("DOMMouseScroll", onMouseWheel) : document.body.onmousewheel = onMouseWheel;

    let isTyping = false;

    const scale = window.localStorage.getItem("no_retina") ? 1 : window.devicePixelRatio;
    const canvas = document.getElementById("canvas");
    const loading = document.getElementById('loading');

    canvas.onmousemove = e => window.input.mouse(e.clientX * scale, e.clientY * scale);
    
    canvas.onmousedown = e => {
        window.input.flushInputHooks();
        window.input.keyDown(e.button + 1);
    }

    canvas.onmouseup = e => {
        window.input.flushInputHooks();
        window.input.keyUp(e.button + 1);
    }

    // --- Profanity Censoring Engine ---
    window.censorText = (text, mode) => {
        if (!text || !mode || mode === "none" || mode === "No censoring") return text;
        const badWords = [
            "fuck", "fucking", "fucked", "fucker", "shit", "shitting", "shitted",
            "bitch", "bitches", "ass", "asshole", "cunt", "dick", "dicks",
            "bastard", "slut", "whore", "pussy", "nigger", "faggot", "retard",
            "damn", "crap", "hell"
        ];
        const pattern = new RegExp("\\b(" + badWords.join("|") + ")\\b", "gi");
        return text.replace(pattern, match => {
            if (mode === "asterisk" || mode === "****") return "*".repeat(match.length);
            if (mode === "hash" || mode === "####") return "#".repeat(match.length);
            if (mode === "censored" || mode === "(censored)") return "(censored)";
            return match;
        });
    };

    // --- Settings Controller ---
    const defaultSettings = {
        toggleClassTree: false,
        autoLevelUp: true,
        censoring: "No censoring"
    };

    let loadedSettings = defaultSettings;
    try {
        const saved = window.localStorage.getItem("diepcustom_settings");
        if (saved) loadedSettings = { ...defaultSettings, ...JSON.parse(saved) };
    } catch(e) {}

    window.diepSettings = loadedSettings;

    const saveSettings = () => {
        try {
            window.localStorage.setItem("diepcustom_settings", JSON.stringify(window.diepSettings));
        } catch(e) {}
    };

    const settingToggleClassTreeEl = document.getElementById("settingToggleClassTree");
    const settingAutoLevelUpEl = document.getElementById("settingAutoLevelUp");
    const settingCensoringEl = document.getElementById("settingCensoring");
    const settingsModalEl = document.getElementById("settingsModal");
    const settingsOverlay = document.getElementById("settingsOverlay");
    const settingsBtn = document.getElementById("settingsBtn");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");

    if (settingToggleClassTreeEl) {
        settingToggleClassTreeEl.checked = Boolean(window.diepSettings.toggleClassTree);
        settingToggleClassTreeEl.onchange = () => {
            window.diepSettings.toggleClassTree = settingToggleClassTreeEl.checked;
            saveSettings();
        };
    }

    if (settingAutoLevelUpEl) {
        settingAutoLevelUpEl.checked = window.diepSettings.autoLevelUp !== false;
        settingAutoLevelUpEl.onchange = () => {
            window.diepSettings.autoLevelUp = settingAutoLevelUpEl.checked;
            saveSettings();
        };
    }

    if (settingCensoringEl) {
        settingCensoringEl.value = window.diepSettings.censoring || "No censoring";
        settingCensoringEl.onmousedown = e => e.stopPropagation();
        settingCensoringEl.onclick = e => e.stopPropagation();
        settingCensoringEl.onchange = () => {
            window.diepSettings.censoring = settingCensoringEl.value;
            saveSettings();
        };
    }

    if (settingsModalEl) {
        settingsModalEl.onmousedown = e => e.stopPropagation();
        settingsModalEl.onclick = e => e.stopPropagation();
    }

    if (settingsBtn) {
        settingsBtn.onmousedown = e => e.stopPropagation();
        settingsBtn.onclick = e => {
            e.stopPropagation();
            if (settingsOverlay) settingsOverlay.style.display = "flex";
        };
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.onmousedown = e => e.stopPropagation();
        closeSettingsBtn.onclick = e => {
            e.stopPropagation();
            if (settingsOverlay) settingsOverlay.style.display = "none";
        };
    }

    if (settingsOverlay) {
        settingsOverlay.onclick = e => {
            if (e.target === settingsOverlay) settingsOverlay.style.display = "none";
        };
    }

    // --- Chat System (Widget Above Minimap & Below-Player Speech Bubbles) ---
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatFeed = document.getElementById("chatFeed");
    const playerChatContainer = document.getElementById("playerChatContainer");

    let playerMessages = []; // Stack of active speech bubbles below tank (max 3, 5s timeout)

    const renderPlayerBubbles = () => {
        if (!playerChatContainer) return;
        playerChatContainer.innerHTML = "";
        playerMessages.forEach(msg => {
            const bubble = document.createElement("div");
            bubble.className = "player-bubble";
            bubble.textContent = msg.text;
            playerChatContainer.appendChild(bubble);
        });
    };

    const addPlayerBubble = (text) => {
        if (!playerChatContainer) return;
        if (playerMessages.length >= 3) {
            const oldest = playerMessages.shift();
            if (oldest && oldest.timer) clearTimeout(oldest.timer);
        }
        const msgObj = { text: text, timer: null };
        msgObj.timer = setTimeout(() => {
            const idx = playerMessages.indexOf(msgObj);
            if (idx !== -1) {
                playerMessages.splice(idx, 1);
                renderPlayerBubbles();
            }
        }, 5000); // Messages get removed after 5 seconds

        playerMessages.push(msgObj);
        renderPlayerBubbles();
    };

    window.chatSystem = {
        addMessage: (sender, text, senderId) => {
            if (!text) return;
            const filteredText = window.censorText(text, window.diepSettings.censoring);
            
            // 1. Add to Above-Minimap Chat Widget Feed
            if (chatFeed) {
                const msgEl = document.createElement("div");
                msgEl.className = "chat-msg";

                const senderEl = document.createElement("span");
                senderEl.className = "chat-sender";
                senderEl.textContent = sender + ":";

                const textNode = document.createTextNode(" " + filteredText);

                msgEl.appendChild(senderEl);
                msgEl.appendChild(textNode);

                chatFeed.appendChild(msgEl);
                chatFeed.scrollTop = chatFeed.scrollHeight;
            }

            // 2. Add to Below-Tank Speech Bubbles (Max 3, 5 seconds timeout)
            addPlayerBubble(filteredText);
        },
        openChat: () => {
            window.setTyping(true);
            if (chatInput) {
                chatInput.focus();
                chatInput.select();
            }
        },
        closeChat: () => {
            if (chatInput) chatInput.value = "";
            window.setTyping(false);
            if (document.activeElement && document.activeElement !== canvas) document.activeElement.blur();
            canvas.focus();
        },
        sendChat: () => {
            if (!chatInput) return;
            const val = chatInput.value.trim().slice(0, 100); // Max 100 chars
            if (val) {
                // Encode ServerBound.Chat packet (opcode 0x0C)
                const encoder = new TextEncoder();
                const strBuf = encoder.encode(val);
                const packet = new Uint8Array(1 + strBuf.length + 1);
                packet[0] = 0x0C; // ServerBound.Chat
                packet.set(strBuf, 1);
                packet[1 + strBuf.length] = 0; // null-terminated

                // Find active open WebSocket connection
                const socket = Module?.cp5?.sockets?.find(s => s && s.readyState === 1) || window.Game?.socket;
                if (socket && socket.readyState === 1) {
                    socket.send(packet);
                } else {
                    // Fallback to local display if socket not connected
                    const playerName = (Module.textInput && Module.textInput.value) || "Player";
                    window.chatSystem.addMessage(playerName, val);
                }
            }
            window.chatSystem.closeChat();
        }
    };

    if (chatInput) {
        chatInput.onkeydown = e => {
            e.stopPropagation();
            if (e.keyCode === 13) { // Enter key sends message
                e.preventDefault();
                window.chatSystem.sendChat();
            } else if (e.keyCode === 27) { // Escape key cancels chat
                e.preventDefault();
                window.chatSystem.closeChat();
            }
        };
        chatInput.onfocus = () => {
            window.setTyping(true);
        };
        chatInput.onblur = () => {
            window.setTyping(false);
        };
    }

    let isClassTreeOpen = false;

    window.onkeydown = e => {
        if (e.repeat) return;

        // Press 'T' key to open chat when not typing
        if ((e.keyCode === 84 || e.code === "KeyT" || e.key === "t" || e.key === "T") && !isTyping) {
            e.preventDefault();
            window.chatSystem.openChat();
            return;
        }

        // Y key: Toggle class tree mode vs hold mode
        if (e.keyCode === 89) {
            if (window.diepSettings.toggleClassTree) {
                e.preventDefault();
                isClassTreeOpen = !isClassTreeOpen;
                if (isClassTreeOpen) {
                    window.input.keyDown(89);
                } else {
                    window.input.keyUp(89);
                }
                return;
            }
        }

        window.input.flushInputHooks();
        if(e.keyCode >= 112 && e.keyCode <= 130 && e.keyCode !== 113) return;
        window.input.keyDown(e.keyCode);
        if(e.keyCode === 9 || !isTyping && e.ctrlKey && e.metaKey) e.preventDefault();
    }

    window.onkeyup = e => {
        // Y key: Ignore keyup in toggle mode
        if (e.keyCode === 89 && window.diepSettings.toggleClassTree) {
            return;
        }

        window.input.flushInputHooks();
        if(e.keyCode >= 112 && e.keyCode <= 130 && e.keyCode !== 113) return;
        window.input.keyUp(e.keyCode);
        if(e.keyCode === 9 || !isTyping && e.ctrlKey && e.metaKey) e.preventDefault();
    }

    canvas.onclick = window.onclick = () => window.input.flushInputHooks();

    canvas.ondragstart = e => e.preventDefault();

    canvas.oncontextmenu = e => window.input.prevent_right_click() ? e.preventDefault() : null;
    
    window.setLoadingStatus = str => loading.innerText = str;

    window.setTyping = val => isTyping = val;

    window.unscale = val => val / scale;

    window.onresize = () => {
        canvas.width = window.innerWidth * scale;
        canvas.height = window.innerHeight * scale;
    }

    window.onresize()
}
