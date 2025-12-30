/**
 * Lumina AI - Comprehensive Logic
 * Copyright (C) 2025 Dextrecs
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const fileInput = document.getElementById("file-input");
const attachBtn = document.getElementById("attach-btn");
const previewContainer = document.getElementById("file-preview");
const sidebar = document.getElementById("sidebar");

let settings = JSON.parse(localStorage.getItem("wa_settings")) || {
    aiName: "Lumina", 
    aiPfp: "assets/pfp.png", 
    theme: "light", 
    promptType: "default", 
    customPrompt: "",
    apiKey: ""
};

let chatHistory = JSON.parse(localStorage.getItem("wa_chat_history")) || [];
let uploadedFiles = [];
let contextTarget = null;

function init() {
    applySettings();
    renderHistory();
    
    if (!settings.apiKey) {
        document.getElementById("setup-overlay").classList.remove("hidden");
    }

    // Sync sidebar fields
    document.getElementById("theme-selector").value = settings.theme;
    document.getElementById("ai-name-input").value = settings.aiName;
    document.getElementById("ai-pfp-input").value = settings.aiPfp;
    document.getElementById("api-key-input").value = settings.apiKey;
    
    const promptTypeSel = document.getElementById("prompt-type");
    const customPromptArea = document.getElementById("custom-prompt-text");
    promptTypeSel.value = settings.promptType;
    
    if(settings.customPrompt) customPromptArea.value = settings.customPrompt;
    if(settings.promptType === 'custom') customPromptArea.classList.remove('hidden');
    
    promptTypeSel.onchange = (e) => {
        customPromptArea.classList.toggle('hidden', e.target.value !== 'custom');
    };
    
    scrollToBottom();
}

async function getModel() {
    if (!settings.apiKey) {
        document.getElementById("setup-overlay").classList.remove("hidden");
        throw new Error("API Key missing");
    }
    const genAI = new GoogleGenerativeAI(settings.apiKey);
    const system = settings.promptType === 'custom' ? settings.customPrompt : "You are Lumina, a friendly AI partner.";
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: system });
}

function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendMessage(role, text, timestamp, files = []) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", role === "user" ? "user-msg" : "ai-msg");
    addLongPressEvent(msgDiv);

    let html = `<div class="msg-content">`;
    files.forEach(f => {
        if(f.mimeType.startsWith('image')) {
            html += `<img src="data:${f.mimeType};base64,${f.data}" style="max-width:100%; border-radius:5px; margin-bottom:5px; display:block;">`;
        }
    });

    let formatted = text
        .replace(/^\*\s/gm, '• ')
        .replace(/(?:```)([\s\S]*?)(?:```)/g, '<pre><code>$1</code></pre>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    html += `${formatted}</div><div class="timestamp">${timestamp}</div>`;
    msgDiv.innerHTML = html;
    chatBox.appendChild(msgDiv);
    scrollToBottom();
    return msgDiv;
}

async function handleChat() {
    const text = userInput.value.trim();
    if (!text && uploadedFiles.length === 0) return;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    appendMessage("user", text, time, uploadedFiles);
    
    chatHistory.push({ role: "user", text, timestamp: time, hasFile: uploadedFiles.length > 0 });
    localStorage.setItem("wa_chat_history", JSON.stringify(chatHistory));

    const modelInput = [text, ...uploadedFiles.map(f => ({ inlineData: f }))];
    userInput.value = ""; 
    uploadedFiles = []; 
    previewContainer.innerHTML = ""; 
    sendBtn.disabled = true;

    const loading = appendMessage("model", "•••", "");

    try {
        const model = await getModel();
        const result = await model.generateContent(modelInput);
        const aiText = (await result.response).text();
        chatBox.removeChild(loading);
        const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        appendMessage("model", aiText, aiTime);
        chatHistory.push({ role: "model", text: aiText, timestamp: aiTime });
        localStorage.setItem("wa_chat_history", JSON.stringify(chatHistory));
    } catch (e) { 
        loading.innerText = "Error: " + e.message; 
    } finally { 
        sendBtn.disabled = false; 
    }
}

attachBtn.onclick = () => fileInput.click();
fileInput.onchange = async (e) => {
    for (const file of e.target.files) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            uploadedFiles.push({ mimeType: file.type, data: base64 });
            let preview;
            if(file.type.startsWith('image')) { 
                preview = document.createElement("img"); 
                preview.src = reader.result; 
            } else { 
                preview = document.createElement("div"); 
                preview.className="preview-doc"; 
                preview.innerHTML='<i class="fa-solid fa-file"></i>'; 
            }
            previewContainer.appendChild(preview);
        };
        reader.readAsDataURL(file);
    }
};

document.getElementById("menu-btn").onclick = () => sidebar.classList.add("open");
document.getElementById("close-sidebar").onclick = () => sidebar.classList.remove("open");

document.getElementById("save-settings").onclick = () => {
    settings.apiKey = document.getElementById("api-key-input").value.trim();
    settings.theme = document.getElementById("theme-selector").value;
    settings.aiName = document.getElementById("ai-name-input").value || "Lumina";
    settings.aiPfp = document.getElementById("ai-pfp-input").value || "assets/pfp.png";
    settings.promptType = document.getElementById("prompt-type").value;
    settings.customPrompt = document.getElementById("custom-prompt-text").value;
    localStorage.setItem("wa_settings", JSON.stringify(settings));
    applySettings(); 
    sidebar.classList.remove("open");
};

document.getElementById("setup-save-btn").onclick = () => {
    const key = document.getElementById("setup-api-key").value.trim();
    if (key) {
        settings.apiKey = key;
        localStorage.setItem("wa_settings", JSON.stringify(settings));
        document.getElementById("setup-overlay").classList.add("hidden");
        document.getElementById("api-key-input").value = key;
    }
};

function applySettings() {
    document.body.setAttribute("data-theme", settings.theme);
    document.getElementById("header-name").innerText = settings.aiName;
    document.getElementById("header-pfp").src = settings.aiPfp;
}

function renderHistory() {
    chatBox.innerHTML = "";
    chatHistory.forEach(m => appendMessage(m.role, m.text, m.timestamp));
}

document.getElementById("download-btn").onclick = () => {
    const txt = chatHistory.map(m => `[${m.timestamp}] ${m.role}: ${m.text}`).join('\n');
    const blob = new Blob([txt], {type:'text/plain'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download='chat.txt'; a.click();
};

document.getElementById("clear-btn").onclick = () => { 
    if(confirm("Clear chat?")) { 
        localStorage.removeItem("wa_chat_history"); 
        location.reload(); 
    }
};

let longPressTimer;
function addLongPressEvent(el) {
    el.oncontextmenu = (e) => { e.preventDefault(); showMenu(e.pageX, e.pageY, el); };
    el.ontouchstart = (e) => { longPressTimer = setTimeout(() => showMenu(e.touches[0].pageX, e.touches[0].pageY, el), 600); };
    el.ontouchend = () => clearTimeout(longPressTimer);
}

function showMenu(x, y, target) {
    contextTarget = target;
    const menu = document.getElementById("context-menu");
    menu.style.display = "block";
    menu.style.left = x + "px"; 
    menu.style.top = y + "px";
}

document.addEventListener("click", () => document.getElementById("context-menu").style.display = "none");

document.getElementById("ctx-delete").onclick = () => contextTarget.remove();
document.getElementById("ctx-copy").onclick = () => {
    const text = contextTarget.querySelector(".msg-content").innerText;
    navigator.clipboard.writeText(text);
};

// Handle mobile viewport changes (keyboard)
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scrollToBottom);
}

init();
sendBtn.onclick = handleChat;
userInput.onkeydown = (e) => { if(e.key==='Enter') handleChat(); };
