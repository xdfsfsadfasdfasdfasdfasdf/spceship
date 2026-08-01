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
    const settingCensoringSliderEl = document.getElementById("settingCensoringSlider");
    const settingCensoringLabelEl = document.getElementById("settingCensoringLabel");
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

    const CENSOR_MODES = ["No censoring", "****", "####", "(censored)"];

    if (settingCensoringSliderEl) {
        let currentMode = window.diepSettings.censoring || "No censoring";
        let initialIdx = CENSOR_MODES.indexOf(currentMode);
        if (initialIdx === -1) initialIdx = 0;
        settingCensoringSliderEl.value = initialIdx;
        if (settingCensoringLabelEl) settingCensoringLabelEl.textContent = CENSOR_MODES[initialIdx];

        const handleSliderChange = () => {
            const idx = parseInt(settingCensoringSliderEl.value, 10) || 0;
            const mode = CENSOR_MODES[idx] || "No censoring";
            window.diepSettings.censoring = mode;
            if (settingCensoringLabelEl) settingCensoringLabelEl.textContent = mode;
            saveSettings();
        };

        settingCensoringSliderEl.oninput = handleSliderChange;
        settingCensoringSliderEl.onchange = handleSliderChange;
        settingCensoringSliderEl.onmousedown = e => e.stopPropagation();
        settingCensoringSliderEl.onclick = e => e.stopPropagation();
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

    // --- Chat System (Widget Top Left & Below-Player Speech Bubbles) ---
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatFeed = document.getElementById("chatFeed");
    const chatContainer = document.getElementById("chatContainer");
    const playerChatContainer = document.getElementById("playerChatContainer");

    if (chatContainer) {
        ["mousedown", "mouseup", "click", "pointerdown", "pointerup", "dblclick"].forEach(eventType => {
            chatContainer.addEventListener(eventType, e => {
                e.stopPropagation();
            });
        });
    }

    let lastUpgradeRenderTime = 0;
    window.notifyUpgradeRender = () => {
        lastUpgradeRenderTime = Date.now();
    };

    const updateChatPosition = () => {
        if (!chatContainer) return;
        const hasUpgrades = (Date.now() - lastUpgradeRenderTime) < 350;
        if (hasUpgrades) {
            chatContainer.classList.add("has-upgrades");
        } else {
            chatContainer.classList.remove("has-upgrades");
        }
    };
    setInterval(updateChatPosition, 100);

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
            if (chatContainer) chatContainer.style.display = "flex";
            if (chatInput) {
                chatInput.focus();
                chatInput.select();
            }
        },
        closeChat: () => {
            if (chatInput) {
                chatInput.value = "";
                chatInput.blur();
            }
            window.setTyping(false);
            if (document.activeElement && document.activeElement !== canvas) {
                document.activeElement.blur();
            }
            if (canvas) canvas.focus();
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
        chatInput.onmousedown = e => {
            e.stopPropagation();
        };
        chatInput.onclick = e => {
            e.stopPropagation();
            chatInput.focus();
        };
        chatInput.onkeydown = e => {
            e.stopPropagation();
            if (e.keyCode === 13 || e.key === "Enter") { // Enter key sends message
                e.preventDefault();
                window.chatSystem.sendChat();
            } else if (e.keyCode === 27 || e.key === "Escape") { // Escape key cancels chat
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

    const textInputContainer = document.getElementById("textInputContainer");
    const textInput = Module?.textInput || document.getElementById("textInput");

    if (textInputContainer) {
        ["mousedown", "mouseup", "click", "pointerdown", "pointerup"].forEach(eventType => {
            textInputContainer.addEventListener(eventType, e => {
                e.stopPropagation();
            });
        });
    }

    if (textInput) {
        ["mousedown", "mouseup", "click", "pointerdown", "pointerup"].forEach(eventType => {
            textInput.addEventListener(eventType, e => {
                e.stopPropagation();
            });
        });
        textInput.onfocus = () => {
            window.setTyping(true);
        };
        textInput.onblur = () => {
            window.setTyping(false);
        };
        textInput.onkeydown = e => {
            e.stopPropagation();
            if (e.keyCode === 13 || e.key === "Enter") {
                window.input.flushInputHooks();
                window.input.keyDown(13);
                setTimeout(() => window.input.keyUp(13), 50);
            }
        };
        textInput.onkeyup = e => {
            e.stopPropagation();
        };
    }

    let isClassTreeOpen = false;

    const checkIsTyping = () => {
        const active = document.activeElement;
        return isTyping || (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA"));
    };

    const isTextInputActive = () => {
        return Boolean(
            Module?.textInput && (
                document.activeElement === Module.textInput ||
                (Module.textInputContainer && Module.textInputContainer.style.display !== "none")
            )
        );
    };

    const handleKeyDown = e => {
        if (e.repeat) return;

        const isEnterKey = e.keyCode === 13 || e.key === "Enter";
        const isSpaceKey = e.keyCode === 32 || e.key === " " || e.code === "Space";
        const hasActiveTank = typeof Module?.exports?.hasTank === "function" ? Boolean(Module.exports.hasTank()) : true;

        // When dead / on death screen or home screen (hasActiveTank is false):
        // Pressing Enter or Space returns to home screen / respawns!
        if ((isEnterKey || isSpaceKey) && !hasActiveTank && !checkIsTyping()) {
            e.preventDefault();
            e.stopPropagation();
            window.input.flushInputHooks();
            window.input.keyDown(13);
            window.input.keyDown(32);
            return;
        }

        // Press 'Enter' key to open chat ONLY when playing (has active tank) and not typing
        if (isEnterKey && hasActiveTank && !checkIsTyping()) {
            e.preventDefault();
            e.stopPropagation();
            window.chatSystem.openChat();
            return;
        }

        // Ignore game keybinds if currently typing in an input field (EXCEPT Enter key when spawn name textInput is active)
        if (checkIsTyping()) {
            if (isEnterKey && (isTextInputActive() || !chatInput || document.activeElement !== chatInput)) {
                // Allow Enter key to pass through to window.input.keyDown(13) so WASM submits name and spawns tank
            } else {
                return;
            }
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
        window.input.keyDown(e.keyCode || 13);
        if(e.keyCode === 9 || (!isTyping && e.ctrlKey && e.metaKey)) e.preventDefault();
    };

    const handleKeyUp = e => {
        const isEnterKey = e.keyCode === 13 || e.key === "Enter";
        const isSpaceKey = e.keyCode === 32 || e.key === " " || e.code === "Space";
        const hasActiveTank = typeof Module?.exports?.hasTank === "function" ? Boolean(Module.exports.hasTank()) : true;

        if ((isEnterKey || isSpaceKey) && !hasActiveTank && !checkIsTyping()) {
            e.preventDefault();
            e.stopPropagation();
            window.input.flushInputHooks();
            window.input.keyUp(13);
            window.input.keyUp(32);
            return;
        }

        // Ignore game keybinds if currently typing in an input field (EXCEPT Enter key when spawn name textInput is active)
        if (checkIsTyping()) {
            if (isEnterKey && (isTextInputActive() || !chatInput || document.activeElement !== chatInput)) {
                // Allow Enter keyup to pass through to window.input.keyUp(13)
            } else {
                return;
            }
        }

        // Y key: Ignore keyup in toggle mode
        if (e.keyCode === 89 && window.diepSettings.toggleClassTree) {
            return;
        }

        window.input.flushInputHooks();
        if(e.keyCode >= 112 && e.keyCode <= 130 && e.keyCode !== 113) return;
        window.input.keyUp(e.keyCode || 13);
        if(e.keyCode === 9 || (!isTyping && e.ctrlKey && e.metaKey)) e.preventDefault();
    };

    window.onkeydown = handleKeyDown;
    window.onkeyup = handleKeyUp;
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

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
