/* ─── NexusAI App.js — Real API Edition ─── */

// ── Auth Guard ──────────────────────────────────────────────────────────────
const token = localStorage.getItem('nexus_token');
const userRaw = localStorage.getItem('nexus_user');
let currentUser = null;

if (!token) {
    window.location.href = '/login.html';
}

if (userRaw) {
    try {
        currentUser = JSON.parse(userRaw);
        // Update sidebar user info
        document.addEventListener('DOMContentLoaded', () => {
            const nameEl = document.querySelector('.user-name');
            const planEl = document.querySelector('.user-plan');
            const avatarEl = document.querySelector('.user-avatar');

            if (currentUser) {
                if (nameEl && currentUser.name) nameEl.textContent = currentUser.name;
                if (planEl) {
                    const planName = currentUser.plan === 'free' ? 'Free Plan' : (currentUser.plan || 'Free') + ' Plan';
                    const credits = currentUser.credits !== undefined ? currentUser.credits : 100;
                    planEl.textContent = `${planName} · ${credits} credits`;
                }
                if (avatarEl) avatarEl.textContent = (currentUser.name || 'U')[0].toUpperCase();

                // Toggle Admin Link
                const adminLink = document.getElementById('admin-link');
                if (adminLink && currentUser.role === 'admin') {
                    adminLink.style.display = 'flex';
                }
            }
        });
    } catch (e) {
        console.error('Failed to parse user data:', e);
        currentUser = null;
    }
}

// ── API Helper ──────────────────────────────────────────────────────────────
async function apiCall(endpoint, body) {
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (res.status === 401) {
            localStorage.removeItem('nexus_token');
            localStorage.removeItem('nexus_user');
            window.location.href = '/login.html';
            return null;
        }

        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Error ${res.status}: Request failed`);
            return data;
        } else {
            const text = await res.text();
            console.error('Server returned non-JSON response:', text);
            throw new Error(`Server Error (${res.status}): The system returned an invalid response. This may be due to a large file size or a connection timeout.`);
        }
    } catch (err) {
        console.error('API Call Error:', err);
        throw err;
    }
}

// ── Logout ──────────────────────────────────────────────────────────────────
function logout() {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    window.location.href = '/login.html';
}

// ── Globals ─────────────────────────────────────────────────────────────────
let currentTool = 'chat';
let currentStyle = 'photorealistic';
let writerTone = 'professional';
let customAgents = [];
let selectedAgent = null;

// Voice Globals
let voiceRecognition = null;
let isVoiceActive = false;
let shouldSpeakResponse = false;

// Knowledge Globals
let knowledgeSyncActive = false;

// Vision Globals
let currentVisionImage = null;

// Web Intelligence Globals
let webSearchActive = false;

// ── Tool Switching ─────────────────────────────────────────────────────────
function switchTool(toolId) {
    currentTool = toolId;
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tool-${toolId}`).classList.add('active');

    // Update Header
    const titles = {
        home: { h1: 'Nexus Home', p: 'Your AI intelligence dashboard.' },
        chat: { h1: 'AI Chat', p: 'Ask anything. Get instant AI-powered answers.' },
        nexussearch: { h1: 'NexusSearch', p: 'Real-time web search with AI-synthesized answers.' },
        library: { h1: 'My Library', p: 'Manage your saved generations and assets.' },
        workspaces: { h1: 'Workspaces', p: 'Organize your projects and collaborations.' },
        writer: { h1: 'Content Writer', p: 'Generate high-quality copy in seconds.' },
        image: { h1: 'Image Prompt AI', p: 'Craft professional prompts for any AI model.' },
        code: { h1: 'Code Helper', p: 'Write, debug, and explain code with AI.' },
        seo: { h1: 'SEO Optimizer', p: 'Analyze and optimize your content for search.' },
        docs: { h1: 'Document AI', p: 'Summarize and analyze large documents.' },
        audio: { h1: 'Audio AI', p: 'Convert voice and audio recordings into text summaries.' }
    };

    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    if (pageTitle && titles[toolId]) pageTitle.textContent = titles[toolId].h1;
    if (pageSubtitle && titles[toolId]) pageSubtitle.textContent = titles[toolId].p;

    if (toolId === 'library') loadLibrary();
    if (toolId === 'workspaces') loadWorkspaces();

    // PWA Mobile Nav Sync
    document.querySelectorAll('.mob-nav-item').forEach(m => {
        m.classList.toggle('active', m.getAttribute('data-tool') === toolId);
    });

    // Desktop Nav Sync
    document.querySelectorAll('.sidebar .nav-item').forEach(m => {
        m.classList.toggle('active', m.getAttribute('data-tool') === toolId);
    });
}

// ── AI Chat Logic ──────────────────────────────────────────────────────────
function handleChatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 'px';
}

// ── Voice & Speech Logic ──────────────────────────────────────────────────
function initVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showToast('⚠️ Speech recognition not supported');
        return false;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    voiceRecognition = new SpeechRecognition();
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = true;
    voiceRecognition.lang = 'en-US';

    voiceRecognition.onstart = () => {
        isVoiceActive = true;
        document.getElementById('voice-overlay').classList.add('show');
        document.getElementById('voice-transcript').textContent = 'Listening...';
        showToast('🎙️ Audio Active');
    };

    voiceRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        document.getElementById('voice-transcript').textContent = transcript;
        if (event.results[0].isFinal) {
            setTimeout(() => {
                stopVoiceSession();
                sendMessage(transcript);
                shouldSpeakResponse = true;
            }, 800);
        }
    };

    voiceRecognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        stopVoiceSession();
        showToast('⚠️ Voice error: ' + event.error);
    };

    voiceRecognition.onend = () => {
        isVoiceActive = false;
    };
    return true;
}

function toggleVoiceSession() {
    if (!voiceRecognition) {
        if (!initVoice()) return;
    }
    if (isVoiceActive) {
        stopVoiceSession();
    } else {
        voiceRecognition.start();
    }
}

function stopVoiceSession() {
    if (voiceRecognition) voiceRecognition.stop();
    document.getElementById('voice-overlay').classList.remove('show');
    isVoiceActive = false;
}

function speakResponse(text) {
    if (!('speechSynthesis' in window)) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    // Clean text (remove markdown for cleaner speech)
    const cleanText = text.replace(/[*#`]/g, '').replace(/\[.*?\]\(.*?\)/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Find a premium-sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Female')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
}

// ── Live Preview State ─────────────────────────────────────────────────────
let lastPreviewCode = '';
let lastPreviewLang = '';

const UNIVERSAL_SYSTEM_PROMPT = `You are NexusAI, a world-class, multi-disciplinary expert assistant. 

YOUR PERSONA:
- Intelligent, efficient, and precise.
- You provide high-level strategic advice, code solutions, or deep research as needed.
- If the user asks general questions, provide clear, structured, and expert answers.
- ONLY provide HTML/UI code if explicitly asked to build, design, or create a visual interface.

STYLE: Professional yet futuristic. Use bolding for emphasis. Use lists for clarity.`;

const ELITE_DESIGNER_PROMPT = `You are NexusAI Studio — The world's #1 AI Creative Director and Senior Frontend Engineer.

YOUR GOAL: Create "Webby-Award" winning designs. Every site you build must be STUNNING, IMMERSIVE, and PREMIUM.

CRITICAL DESIGN REQUIREMENTS:
1. LAYOUT: Use modern layouts like Bento Grids, Full-screen Heros, and ultra-wide spacing. Perfect flexbox/grid.
2. VISUALS: Mandatory use of high-resolution photography.
   - HERO: Use high-quality splash imagery.
   - CONTENT: Use keyword-based Unsplash images: https://source.unsplash.com/featured/800x600/?{keyword}
3. AESTHETICS: 
   - Use Dark Mode by default with neon accents (Purple/Blue/Cyan).
   - Glassmorphism: background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1);
   - Typography: Use "Outfit" or "Inter" from Google Fonts. Font-weights: 900 for headings.
4. INTERACTION: 
   - Add hover effects to every button and card (tilt, glow, lift).
   - Use smooth CSS animations.
5. NO PLACEHOLDERS: Write real, persuasive marketing copy and include real functional components.

Always wrap your masterpiece in \`\`\`html code blocks. BE ELITE.`;

async function sendMessage(preText, immediate) {
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-messages');
    const text = preText || input.value.trim();

    if (!text) return;

    appendMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    container.scrollTop = container.scrollHeight;

    const typingId = addTypingIndicator();
    container.scrollTop = container.scrollHeight;

    try {
        const messages = Array.from(container.querySelectorAll('.message')).slice(-20);
        const history = messages.map(m => {
            const textEl = m.querySelector('.text');
            return {
                role: m.classList.contains('user') ? 'user' : 'assistant',
                text: textEl ? textEl.textContent : ''
            };
        }).filter(h => h.text.trim() !== '');

        // KNOWLEDGE BASE SYNC: Fetch context from Nexus Memory
        let knowledgeContext = "";
        if (knowledgeSyncActive) {
            knowledgeContext = await getKnowledgeContext(text);
        }

        // WEB INTELLIGENCE: Fetch live context if active
        let webContext = "";
        if (webSearchActive) {
            webContext = await getWebContext(text);
        }

        // SMART INTENT ROUTING
        let activeSystemPrompt = selectedAgent?.systemPrompt;
        if (!activeSystemPrompt) {
            const creativeKeywords = ['build', 'design', 'website', 'landing', 'ui', 'creative', 'visual', 'page', 'mockup', 'navbar', 'css', 'glassmorphism'];
            const isCreative = creativeKeywords.some(kw => text.toLowerCase().includes(kw));
            activeSystemPrompt = isCreative ? ELITE_DESIGNER_PROMPT : UNIVERSAL_SYSTEM_PROMPT;
        }

        // If we have knowledge or web context, we append it as priority system instructions
        let combinedContext = "";
        if (knowledgeContext) combinedContext += `[KNOWLEDGE BASE]: ${knowledgeContext}\n\n`;
        if (webContext) combinedContext += `[LIVE WEB DATA]: ${webContext}\n\n`;

        const finalSystemPrompt = combinedContext
            ? `${combinedContext}${activeSystemPrompt}`
            : activeSystemPrompt;

        const data = await apiCall('/api/ai/chat', {
            message: text,
            history,
            agentSystemPrompt: finalSystemPrompt,
            imageData: currentVisionImage
        });

        clearVisionImage(); // Clear after sending

        removeTypingIndicator(typingId);
        if (data?.reply) {
            appendMessage('ai', data.reply);
            container.scrollTop = container.scrollHeight;

            // VOICE MASTER: Speak if reply was triggered by voice
            if (shouldSpeakResponse) {
                speakResponse(data.reply);
                shouldSpeakResponse = false; // Reset for next message
            }
            // Check if the response contains runnable code
            tryRenderPreview(data.reply);
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        appendMessage('ai', `Sorry, I encountered an error: ${err.message}`, true);
        container.scrollTop = container.scrollHeight;
    }
}

function appendMessage(role, text, isError = false) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;

    // Render code blocks with a syntax-highlighted pre and a "Run" button
    const renderedText = renderMessageContent(text, isError);

    msg.innerHTML = `
        <div class="avatar">${role === 'user' ? (currentUser?.name || 'U')[0] : 'N'}</div>
        <div class="content">
            <div class="text" ${isError ? 'style="color:#fca5a5"' : ''}>${renderedText}</div>
            <div class="time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

/**
 * Parses AI reply: renders markdown and wraps code blocks in a styled <pre>
 * with a "Run in Preview" button for HTML blocks.
 */
function renderMessageContent(text, isError) {
    if (isError) return `<span style="color:#fca5a5">${text}</span>`;

    // Split on \```lang\n...\n``` blocks
    const parts = text.split(/(```[\w]*\n[\s\S]*?```)/g);
    return parts.map(part => {
        const codeMatch = part.match(/^```([\w]*)\n([\s\S]*)```$/);
        if (codeMatch) {
            const lang = codeMatch[1] || 'code';
            const code = codeMatch[2];
            const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const isHtml = lang.toLowerCase() === 'html';
            const runBtn = isHtml
                ? `<button onclick="renderInPreview(${JSON.stringify(code)}, 'html')" style="margin-left:8px; background:var(--primary); border:none; color:white; padding:3px 10px; border-radius:6px; font-size:11px; cursor:pointer;">▶ Run</button>`
                : (lang.toLowerCase() !== 'text' && lang.toLowerCase() !== 'markdown'
                    ? `<button onclick="renderInPreview(${JSON.stringify(code)}, ${JSON.stringify(lang)})" style="margin-left:8px; background:rgba(255,255,255,0.08); border:1px solid var(--border); color:var(--text-secondary); padding:3px 10px; border-radius:6px; font-size:11px; cursor:pointer;">View Code</button>`
                    : '');

            return `<div style="margin:10px 0; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
                <div style="background:rgba(0,0,0,0.5); padding:8px 14px; font-size:11px; color:var(--text-secondary); display:flex; align-items:center; justify-content:space-between;">
                    <span>${lang}</span>${runBtn}
                </div>
                <pre style="background:#0a0a0f; margin:0; padding:16px; font-size:12px; font-family:monospace; overflow-x:auto; line-height:1.5; color:#e2e8f0; white-space:pre;"><code>${escapedCode}</code></pre>
            </div>`;
        }
        // Regular markdown text
        return formatText(part);
    }).join('');
}

function addTypingIndicator() {
    const id = 'typing-' + Date.now();
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.id = id;
    msg.className = 'message ai typing';
    msg.innerHTML = `
        <div class="avatar">N</div>
        <div class="content"><div class="dots"><span>.</span><span>.</span><span>.</span></div></div>
    `;
    container.appendChild(msg);
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function formatText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-family:monospace; font-size:12px;">$1</code>')
        .replace(/^#{1,3} (.+)/gm, '<strong style="font-size:15px;">$1</strong>')
        .replace(/^[•\-\*] (.+)/gm, '<li>$1</li>')
        .replace(/^\d+\. (.+)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul style="padding-left:20px; margin:8px 0;">$1</ul>')
        .replace(/\n/g, '<br/>');
}

// ── Live Preview Engine ────────────────────────────────────────────────────

/**
 * Auto-detects if the AI reply contains HTML and renders it in the preview panel.
 */
function tryRenderPreview(reply) {
    const htmlMatch = reply.match(/```html\n([\s\S]*?)```/);
    if (htmlMatch) {
        renderInPreview(htmlMatch[1], 'html');
        return;
    }
    // Also detect bare <!DOCTYPE html> blocks
    const doctypeMatch = reply.match(/(<!DOCTYPE html>[\s\S]*<\/html>)/i);
    if (doctypeMatch) {
        renderInPreview(doctypeMatch[1], 'html');
    }
}

/**
 * Renders code into the iframe preview panel.
 */
function renderInPreview(code, lang) {
    lastPreviewCode = code;
    lastPreviewLang = lang;

    const frame = document.getElementById('preview-frame');
    const idle = document.getElementById('preview-idle');
    const tabs = document.getElementById('preview-code-tabs');
    const urlBar = document.getElementById('preview-url');
    const badge = document.getElementById('preview-lang-badge');
    const previewPanel = document.getElementById('chat-preview');

    // Show preview panel (especially for mobile)
    if (previewPanel) previewPanel.classList.add('preview-active');

    if (lang === 'html') {
        // Inject HTML directly into iframe
        idle.style.display = 'none';
        frame.style.display = 'block';
        tabs.style.display = 'flex';
        badge.textContent = 'HTML/CSS/JS';
        urlBar.textContent = 'nexusai://live-preview';

        const frameDoc = frame.contentDocument || frame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(code);
        frameDoc.close();

        // Store code in the code view tab
        document.getElementById('preview-code-pre').textContent = code;
        setPreviewTab('preview');
    } else {
        // Non-HTML code — show in code view tab only
        idle.style.display = 'none';
        frame.style.display = 'none';
        tabs.style.display = 'flex';
        badge.textContent = lang.toUpperCase();
        urlBar.textContent = `nexusai://code/${lang}`;
        document.getElementById('preview-code-pre').textContent = code;
        setPreviewTab('code');
    }

    showToast(`▶ Running in Live Preview`);
}

function setPreviewTab(tab) {
    const frame = document.getElementById('preview-frame');
    const codeView = document.getElementById('preview-code-view');
    const tabPreview = document.getElementById('tab-preview');
    const tabCode = document.getElementById('tab-code');

    if (tab === 'preview') {
        frame.style.display = 'block';
        codeView.style.display = 'none';
        tabPreview.style.color = 'var(--primary)';
        tabCode.style.color = 'var(--text-secondary)';
    } else {
        frame.style.display = 'none';
        codeView.style.display = 'block';
        tabPreview.style.color = 'var(--text-secondary)';
        tabCode.style.color = 'var(--primary)';
    }
}

function refreshPreview() {
    if (lastPreviewCode) renderInPreview(lastPreviewCode, lastPreviewLang);
}

function openPreviewFullscreen() {
    if (!lastPreviewCode || lastPreviewLang !== 'html') { showToast('⚠️ No HTML preview to open'); return; }
    const win = window.open();
    win.document.write(lastPreviewCode);
    win.document.close();
}

function copyPreviewCode() {
    if (!lastPreviewCode) { showToast('⚠️ Nothing to copy'); return; }
    navigator.clipboard.writeText(lastPreviewCode).then(() => showToast('📋 Code copied!'));
}

// ── Content Writer ─────────────────────────────────────────────────────────
function setTone(btn, tone) {
    writerTone = tone;
    document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function generateContent() {
    const type = document.getElementById('content-type').value;
    const topic = document.getElementById('writer-topic').value.trim() || 'AI tools for 2026';
    const length = parseInt(document.getElementById('content-length').value) || 500;
    const output = document.getElementById('writer-output');

    output.classList.add('generating');
    output.textContent = '✨ Generating high-quality content...';

    try {
        const data = await apiCall('/api/ai/content', { type, topic, tone: writerTone, length });
        output.classList.remove('generating');
        if (data) {
            output.textContent = data.content;
            const wc = data.content.split(/\s+/).filter(Boolean).length;
            document.getElementById('word-count').textContent = `${wc} words generated`;
            showToast('✅ Content generated!');
        }
    } catch (err) {
        output.classList.remove('generating');
        output.textContent = `Error: ${err.message}`;
        showToast('❌ Generation failed');
    }
}

function regenerateContent() { generateContent(); }

function copyOutput() {
    const text = document.getElementById('writer-output').textContent;
    if (!text || text.includes('Your AI-generated')) return;
    navigator.clipboard.writeText(text).then(() => showToast('📋 Copied!'));
}

// ── Image Prompt ───────────────────────────────────────────────────────────
function setStyle(btn, style) {
    currentStyle = style;
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function generateImagePrompt() {
    const concept = document.getElementById('image-concept').value.trim() || 'a futuristic city at night';
    const platform = document.getElementById('img-platform').value;
    const results = document.getElementById('prompt-results');

    results.innerHTML = '<div style="color:var(--accent);font-size:14px;padding:16px;text-align:center;">🎨 Crafting professional prompts...</div>';

    try {
        const data = await apiCall('/api/ai/image-prompt', { concept, style: currentStyle, platform });
        results.innerHTML = '';
        if (data?.prompts) {
            data.prompts.forEach((p, i) => {
                setTimeout(() => {
                    const card = document.createElement('div');
                    card.className = 'prompt-card card-3d';
                    card.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <span style="font-size:11px;background:rgba(124,58,237,0.2);color:#a78bfa;padding:3px 10px;border-radius:20px;border:1px solid rgba(124,58,237,0.3);">${platform} Prompt ${i + 1}</span>
            </div>
            <p>${p}</p>
            <button class="sm-btn copy-prompt" onclick="copyPromptText(this, \`${p.replace(/`/g, "'")}\`)">📋 Copy</button>`;
                    results.appendChild(card);

                }, i * 300);
            });
            showToast('🎨 Prompts ready!');
        }
    } catch (err) {
        results.innerHTML = `<div style="color:#fca5a5;padding:20px">Error: ${err.message}</div>`;
    }
}

function copyPromptText(btn, text) {
    navigator.clipboard.writeText(text).then(() => showToast('📋 Copied!'));
}

async function generateRealImage() {
    const concept = document.getElementById('image-concept').value.trim();
    const resultDiv = document.getElementById('real-image-result');
    const promptDiv = document.getElementById('prompt-results');

    if (!concept) {
        showToast('⚠️ Please enter a concept first');
        return;
    }

    promptDiv.style.display = 'none';
    resultDiv.style.display = 'block';

    // Premium loading state with Studio Glow
    resultDiv.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; padding:60px; gap:25px; background:rgba(15, 15, 20, 0.6); border-radius:40px; border:1px solid rgba(139, 92, 246, 0.2); box-shadow: 0 0 50px rgba(139, 92, 246, 0.1);">
            <div class="studio-loader"></div>
            <div style="color:#a78bfa; font-weight:900; font-size:22px; letter-spacing:2px; text-transform:uppercase; text-shadow: 0 0 20px rgba(167, 139, 250, 0.5);">Nexus Studio</div>
            <div style="color:var(--text-secondary); font-size:14px; text-align:center; max-width:320px; line-height:1.7; opacity:0.8;">
                Synthesizing high-fidelity neural patterns...<br>
                Optimizing lighting & composition...
            </div>
        </div>
        <style>
            .studio-loader { width: 60px; height: 60px; border: 3px solid rgba(139, 92, 246, 0.1); border-top: 3px solid #a78bfa; border-radius: 50%; animation: spinStudio 1s cubic-bezier(0.4, 0, 0.2, 1) infinite; filter: drop-shadow(0 0 10px #a78bfa); }
            @keyframes spinStudio { to { transform: rotate(360deg); } }
        </style>`;

    try {
        const res = await apiCall('/api/ai/generate-image', { prompt: concept });
        const urls = res.urls;

        // Reliability Engine: Direct -> Nodes -> Proxy -> Precision Search -> Universal
        const proxyUrl = (target) => `https://images.weserv.nl/?url=${encodeURIComponent(target)}&w=1024&h=1024&fit=cover`;

        const img = new Image();
        img.style.width = '100%';
        img.style.maxWidth = '700px';
        img.style.borderRadius = '32px';
        img.style.boxShadow = '0 50px 120px rgba(0,0,0,0.9), 0 0 80px rgba(139, 92, 246, 0.2)';
        img.style.display = 'block';
        img.style.opacity = '0';
        img.style.transform = 'scale(0.95) translateY(20px)';
        img.style.transition = 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)';

        img.onload = () => {
            resultDiv.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; gap:32px; padding:10px;"></div>';
            const container = resultDiv.querySelector('div');
            container.appendChild(img);

            // Trigger animation
            setTimeout(() => {
                img.style.opacity = '1';
                img.style.transform = 'scale(1) translateY(0)';
            }, 100);

            const safePrompt = concept.replace(/'/g, '&#39;');
            const footer = document.createElement('div');
            footer.innerHTML = `
                <div style="position:relative; margin-top:-80px; width:100%; max-width:600px; padding:30px; background:rgba(20,20,30,0.4); backdrop-filter:blur(20px); border-radius:0 0 32px 32px; border-top:1px solid rgba(255,255,255,0.05); text-align:center;">
                    <div style="font-size:16px; color:#fff; font-weight:600; margin-bottom:15px; text-shadow: 0 5px 15px rgba(0,0,0,0.5);">"${concept}"</div>
                    <div style="display:flex; gap:16px; justify-content:center; flex-wrap:wrap;">
                        <a href="${img.src}" download="nexusai-studio-${Date.now()}.png" class="primary-btn" style="padding:14px 40px; font-size:15px; border-radius:18px; box-shadow: 0 10px 30px rgba(139, 92, 246, 0.4);"><i class="fas fa-crown"></i> Download 4K</a>
                        <button class="glass" style="padding:14px 40px; border-radius:18px; color:white; border:1px solid rgba(255,255,255,0.1); backdrop-filter:blur(10px);" onclick="generateRealImage()"><i class="fas fa-random"></i> Regenerate</button>
                    </div>
                </div>`;
            container.appendChild(footer);
            showToast('💎 Masterpiece Finalized');
        };

        // The Bulletproof Execution Chain
        let currentStage = 0;
        const tryNext = () => {
            currentStage++;
            console.log(`[Studio] Image Chain Stage ${currentStage}...`);

            if (currentStage === 1) img.src = urls.primary; // Direct Legacy
            else if (currentStage === 2) img.src = urls.secondary; // Direct Cloud
            else if (currentStage === 3) img.src = proxyUrl(urls.primary); // Weserv Proxy
            else if (currentStage === 4) {
                // Universal Precision Match (Guaranteed relevance for ANY concept)
                const query = encodeURIComponent(`${concept},realistic,professional,high-resolution`);
                img.src = `https://source.unsplash.com/featured/1024x1024/?${query}`;
            } else if (currentStage === 5) {
                // Secondary high-speed precision fallback
                const tags = concept.replace(/\s+/g, ',');
                img.src = `https://loremflickr.com/1024/1024/${encodeURIComponent(tags)}/all`;
            } else {
                resultDiv.innerHTML = `<div style="color:#fca5a5; padding:80px; text-align:center; background:rgba(0,0,0,0.2); border-radius:30px;">
                    <i class="fas fa-exclamation-circle" style="font-size:40px; margin-bottom:20px; color:#ef4444;"></i><br>
                    <strong style="font-size:18px;">Studio Connection Failed</strong><br>
                    <p style="opacity:0.6; margin-top:10px;">Network conditions are extremely poor. Please check your connection.</p>
                    <button onclick="generateRealImage()" class="primary-btn" style="margin-top:20px; padding:12px 40px;">Reconnect Studio</button>
                </div>`;
            }
        };

        img.onerror = tryNext;
        tryNext();

    } catch (err) {
        resultDiv.innerHTML = `<div style="color:#fca5a5; padding:60px; text-align:center;">API Error: ${err.message}</div>`;
    }
}

function saveImageToLibrary(url, concept) {
    saveToLibrary('image', `AI Gen: ${concept.substring(0, 20)}`, url, { prompt: concept });
}

// ── Code Helper ────────────────────────────────────────────────────────────
async function generateCode() {
    const language = document.getElementById('code-lang').value;
    const taskEl = document.getElementById('code-task');
    const taskType = taskEl ? taskEl.value : 'implement the requested functionality';
    const description = document.getElementById('code-prompt').value.trim() || 'Create a simple "Hello World" example';
    const output = document.getElementById('code-output');

    output.innerHTML = '<code class="code-placeholder">⚡ Generating optimized code...</code>';

    try {
        const data = await apiCall('/api/ai/code', { language, taskType, description });
        if (data) {
            output.textContent = data.code;
            showToast('⚡ Code generated!');
        }
    } catch (err) {
        output.innerHTML = `<code style="color:#fca5a5">Error: ${err.message}</code>`;
    }
}

function copyCode() {
    const code = document.getElementById('code-output').textContent;
    if (code.includes('will appear here') || code.includes('Generating')) return;
    navigator.clipboard.writeText(code).then(() => showToast('📋 Copied!'));
}

// ── SEO Tool ───────────────────────────────────────────────────────────────
async function analyzeSEO() {
    const keyword = document.getElementById('seo-keyword').value.trim();
    const content = document.getElementById('seo-content').value.trim();
    const results = document.getElementById('seo-results');

    if (!keyword || !content) {
        showToast('⚠️ Keyword and Content are required!');
        return;
    }

    results.innerHTML = '<div style="color:var(--primary); padding:40px;">🔍 AI is analyzing SEO metrics...</div>';

    try {
        const data = await apiCall('/api/ai/seo', { keyword, content });
        if (!data) return;

        results.innerHTML = `
      <div class="seo-card glass card-3d" style="padding:20px; border-radius:16px; margin-bottom:16px;">
        <h4 style="margin-bottom:10px;">📊 Overall SEO Score</h4>
        <div style="font-size:24px; font-weight:800; color:var(--primary); margin-bottom:8px;">✅ ${data.score}/100</div>
        <p style="color:var(--text-secondary);font-size:13px">Your content is ${data.score >= 70 ? 'well optimized' : 'needs improvement'}.</p>
      </div>
      <div class="seo-card glass card-3d" style="padding:20px; border-radius:16px; margin-bottom:16px;">
        <h4 style="margin-bottom:10px;">🔑 Keyword Analysis</h4>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-secondary)">
          <div>• Keyword density: <strong style="color:var(--text-primary)">${data.keyword_density || 'N/A'}</strong></div>
          <div>• Search intent: <strong style="color:var(--text-primary)">${data.search_intent || 'Informational'}</strong></div>
          <div>• Competition: <strong style="color:var(--text-primary)">${data.competition || 'Medium'}</strong></div>
          <div>• LSI Keywords: <em>${(data.lsi_keywords || []).join(', ')}</em></div>
        </div>
      </div>
      <div class="seo-card glass card-3d" style="padding:20px; border-radius:16px; margin-bottom:16px;">
        <h4 style="margin-bottom:10px;">💡 AI Recommendations</h4>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-secondary)">
          ${(data.recommendations || []).map(r => `<div>• ${r}</div>`).join('')}
        </div>
      </div>
      <div class="seo-card glass card-3d" style="padding:20px; border-radius:16px;">
        <h4 style="margin-bottom:10px;">🏷️ Meta Data</h4>
        <div style="background:rgba(0,0,0,0.3); border-radius:12px; padding:16px; font-size:13px;">
          <strong>Title:</strong> ${data.meta_title}<br/><br/>
          <strong>Description:</strong> ${data.meta_description}
        </div>
      </div>`;
        showToast('✅ SEO analysis complete!');

    } catch (err) {
        results.innerHTML = `<div style="color:#fca5a5;padding:20px">Error: ${err.message}</div>`;
    }
}

// ── Modal Controls ────────────────────────────────────────────────────────
function showSettings() {
    document.getElementById('settings-modal').classList.add('show');
    const nameInput = document.getElementById('settings-name');
    if (nameInput && currentUser) nameInput.value = currentUser.name || '';
}
function hideSettings() { document.getElementById('settings-modal').classList.remove('show'); }
function saveSettings() {
    const name = document.getElementById('settings-name').value;
    if (name) {
        currentUser.name = name;
        localStorage.setItem('nexus_user', JSON.stringify(currentUser));
        document.querySelector('.user-name').textContent = name;
        showToast('✅ Settings saved!');
    }
    hideSettings();
}

function showNotifications() { document.getElementById('notifications-modal').classList.add('show'); }
function hideNotifications() { document.getElementById('notifications-modal').classList.remove('show'); }

// ── NexusSearch — Perplexity-Like AI Search ────────────────────────────────
function setNexusQuery(text) {
    document.getElementById('nexussearch-input').value = text;
    runNexusSearch();
}

function renderNexusMarkdown(text) {
    // Render basic markdown + replace [1], [2] etc. with citation badges
    return text
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code style="background:rgba(16,185,129,0.1);padding:2px 6px;border-radius:4px;font-family:monospace;">$1</code>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/\[(\d+)\]/g, '<span class="nexus-citation">$1</span>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^(.+)$(?!.*<\/)/, '<p>$1</p>');
}

async function runNexusSearch() {
    const query = document.getElementById('nexussearch-input').value.trim();
    if (!query) return;

    const loading = document.getElementById('nexussearch-loading');
    const results = document.getElementById('nexussearch-results');
    const sourcesEl = document.getElementById('nexussearch-sources');
    const answerEl = document.getElementById('nexussearch-answer');

    // Show loading state
    loading.style.display = 'block';
    results.style.display = 'none';

    try {
        const data = await apiCall('/api/web/search', { query });

        // Render source cards
        if (data.sources && data.sources.length > 0) {
            sourcesEl.innerHTML = data.sources.map(s => `
                <a class="nexus-source-card" href="${s.url}" target="_blank" rel="noopener">
                    <div class="nexus-source-num">${s.index}</div>
                    <div class="nexus-source-title">${s.title}</div>
                    <div class="nexus-source-domain">
                        <img src="https://www.google.com/s2/favicons?domain=${s.source}&sz=16" style="width:14px;height:14px;border-radius:3px;" onerror="this.style.display='none'">
                        ${s.source}
                    </div>
                </a>
            `).join('');
        } else {
            sourcesEl.innerHTML = '<p style="color:var(--text-secondary); font-size:13px;">No sources found.</p>';
        }

        // Render AI answer with animated typewriter
        answerEl.innerHTML = '';
        loading.style.display = 'none';
        results.style.display = 'block';

        // Typewriter effect
        const rendered = renderNexusMarkdown(data.answer || 'No answer generated.');
        answerEl.innerHTML = rendered;

        // Scroll to results
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
        loading.style.display = 'none';
        results.style.display = 'block';
        sourcesEl.innerHTML = '';
        answerEl.innerHTML = `<div style="color:#fca5a5;"><i class="fas fa-exclamation-triangle"></i> Search failed: ${err.message}</div>`;
    }
}


// ── Upgrade / Payments ─────────────────────────────────────────────────────
let currentSelectedPlan = null;

function showUpgrade() {
    document.getElementById('pricing-view').style.display = 'block';
    document.getElementById('payment-method-view').style.display = 'none';
    document.getElementById('direct-upi-view').style.display = 'none';
    document.getElementById('upgrade-modal').classList.add('show');
}
function hideUpgrade() {
    document.getElementById('upgrade-modal').classList.remove('show');
}

let billingCycle = 'monthly';
function toggleBilling() {
    billingCycle = billingCycle === 'monthly' ? 'yearly' : 'monthly';
    const toggle = document.getElementById('billing-toggle');
    const labelMonthly = document.getElementById('label-monthly');
    const labelYearly = document.getElementById('label-yearly');

    toggle.classList.toggle('yearly');
    labelMonthly.classList.toggle('active');
    labelYearly.classList.toggle('active');

    const prices = {
        monthly: { starter: '₹799', pro: '₹2,499', business: '₹7,999' },
        yearly: { starter: '₹639', pro: '₹1,999', business: '₹6,399' }
    };

    document.getElementById('price-starter').innerHTML = `${prices[billingCycle].starter}<span>/${billingCycle === 'monthly' ? 'mo' : 'mo'}</span>`;
    document.getElementById('price-pro').innerHTML = `${prices[billingCycle].pro}<span>/${billingCycle === 'monthly' ? 'mo' : 'mo'}</span>`;
    document.getElementById('price-business').innerHTML = `${prices[billingCycle].business}<span>/${billingCycle === 'monthly' ? 'mo' : 'mo'}</span>`;
}

function selectPlan(plan) {
    currentSelectedPlan = plan;
    const pricing = {
        monthly: { starter: '₹799', pro: '₹2,499', business: '₹7,999' },
        yearly: { starter: '₹6,390', pro: '₹19,990', business: '₹63,990' } // Total for the year
    };

    // For display in method view
    const displayPrice = billingCycle === 'monthly' ?
        pricing.monthly[plan] :
        pricing.monthly[plan].replace('₹', '₹') + " (Billed Yearly)"; // Let's keep it simple for now

    document.getElementById('selected-plan-name').textContent = plan.toUpperCase() + ` Plan (${billingCycle})`;
    document.getElementById('display-amount').textContent = billingCycle === 'monthly' ? pricing.monthly[plan] : pricing.yearly[plan];

    document.getElementById('pricing-view').style.display = 'none';
    document.getElementById('payment-method-view').style.display = 'block';
}

function backToPricing() {
    document.getElementById('pricing-view').style.display = 'block';
    document.getElementById('payment-method-view').style.display = 'none';
}

function showDirectUPI() {
    document.getElementById('payment-method-view').style.display = 'none';
    document.getElementById('direct-upi-view').style.display = 'block';
}

function backToMethods() {
    document.getElementById('payment-method-view').style.display = 'block';
    document.getElementById('direct-upi-view').style.display = 'none';
}

async function payWithRazorpay() {
    const plan = currentSelectedPlan;
    showToast('💳 Preparing Razorpay...');
    try {
        const data = await apiCall('/api/payments/razorpay-order', { plan });
        if (!data || !data.order) throw new Error('Order creation failed.');

        const options = {
            key: data.key_id,
            amount: data.order.amount,
            currency: data.order.currency,
            name: "NexusAI Studio",
            description: `Upgrade to ${plan.toUpperCase()}`,
            image: "assets/bot-avatar.png",
            order_id: data.order.id,
            handler: async function (response) {
                showToast('⌛ Verifying payment...');
                const verifyRes = await apiCall('/api/payments/razorpay-verify', {
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    plan: plan
                });
                if (verifyRes && verifyRes.success) {
                    showToast('✅ Upgrade Successful!');
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showToast('❌ Verification failed.');
                }
            },
            prefill: {
                name: JSON.parse(localStorage.getItem('nexus_user'))?.name || '',
                email: JSON.parse(localStorage.getItem('nexus_user'))?.email || ''
            },
            theme: { color: "#8b5cf6" }
        };
        const rzp = new Razorpay(options);
        rzp.open();
    } catch (err) {
        showToast('❌ ' + err.message);
    }
}

async function submitManualPayment() {
    const transactionId = document.getElementById('manual-trnx-id').value.trim();
    if (!transactionId) return showToast('⚠️ Please enter Transaction ID');

    showToast('📤 Submitting...');
    try {
        const res = await apiCall('/api/payments/manual-submit', {
            plan: currentSelectedPlan,
            transactionId: transactionId
        });
        if (res.success) {
            showToast('✅ Submitted! Admin will verify.');
            setTimeout(() => hideUpgrade(), 2000);
        } else {
            throw new Error(res.error || 'Submission failed');
        }
    } catch (err) {
        showToast('❌ ' + err.message);
    }
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Library & Workspaces Logic ──────────────────────────────────────────────
async function loadLibrary() {
    const list = document.getElementById('library-list');
    list.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding:40px; color:var(--primary);">✨ Loading your library...</div>';

    try {
        const res = await fetch('/api/workspaces/library', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const items = await res.json();

        if (!items || items.length === 0) {
            list.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:100px; color:var(--text-secondary);">
                  <i class="fas fa-box-open" style="font-size:60px; margin-bottom:20px; opacity:0.1;"></i>
                  <p>Your library is empty. Save any AI generation to see it here.</p>
                </div>`;
            return;
        }

        list.innerHTML = items.map(item => `
            <div class="glass premium-card card-3d">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <span style="font-size:10px; background:rgba(139,92,246,0.1); color:var(--primary); padding:4px 8px; border-radius:6px; font-weight:700;">${item.type.toUpperCase()}</span>
                <button class="glass" style="width:28px; height:28px; border-radius:50%; cursor:pointer;" onclick="deleteLibraryItem('${item.id}')"><i class="fas fa-trash" style="font-size:10px; color:var(--text-secondary);"></i></button>
              </div>
              <h4 style="margin-bottom:8px; font-size:15px;">${item.title}</h4>
              <p style="font-size:13px; color:var(--text-secondary); line-height:1.5; max-height:100px; overflow:hidden;">${item.content.substring(0, 150)}...</p>
              <div style="margin-top:auto; padding-top:16px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:10px; color:var(--text-secondary);">${new Date(item.createdAt).toLocaleDateString()}</span>
                <button class="primary-btn" style="padding:6px 12px; font-size:11px;" onclick="viewLibraryItem('${item.id}')">View Full</button>
              </div>
            </div>
        `).join('');

    } catch (err) {
        list.innerHTML = `<div style="grid-column: 1 / -1; color:#fca5a5; text-align:center;">Failed to load library: ${err.message}</div>`;
    }
}

async function saveToLibrary(type, title, content, metadata = {}) {
    showToast('💾 Saving to library...');
    try {
        await apiCall('/api/workspaces/library', { type, title, content, metadata });
        showToast('✅ Saved to Library!');
    } catch (err) {
        showToast('❌ Failed: ' + err.message);
    }
}

async function loadWorkspaces() {
    const grid = document.getElementById('workspace-grid');
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding:40px; color:var(--primary);">📂 Loading workspaces...</div>';

    try {
        const res = await fetch('/api/workspaces', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const workspaces = await res.json();

        let html = `
            <div class="glass premium-card card-3d" style="align-items:center; justify-content:center; text-align:center; cursor:pointer; border-style:dashed;" onclick="createNewWorkspace()">
              <i class="fas fa-plus-circle" style="font-size:40px; color:var(--primary); margin-bottom:16px;"></i>
              <h3>Create Project</h3>
              <p style="font-size:12px; color:var(--text-secondary); margin-top:8px;">Organize your work into folders</p>
            </div>`;

        workspaces.forEach(w => {
            html += `
                <div class="glass premium-card card-3d" style="position:relative;">
                  <div class="logo-icon" style="margin-bottom:20px; background:var(--surface);"><i class="fas fa-${w.icon || 'folder'}"></i></div>
                  <h3>${w.name}</h3>
                  <p style="font-size:12px; color:var(--text-secondary); margin-top:8px;">Project Workspace</p>
                  <div style="margin-top:20px; display:flex; gap:8px;">
                     <button class="glass" style="padding:8px; border-radius:10px; flex:1; font-size:12px;">Open</button>
                     <button class="glass" style="padding:8px; border-radius:10px; width:40px;"><i class="fas fa-ellipsis-v"></i></button>
                  </div>
                </div>`;
        });

        grid.innerHTML = html;

    } catch (err) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; color:#fca5a5;">Error: ${err.message}</div>`;
    }
}

async function createNewWorkspace() {
    const name = prompt("Enter project name:");
    if (!name) return;

    try {
        await apiCall('/api/workspaces', { name, icon: 'folder' });
        loadWorkspaces();
        showToast('📁 Workspace created!');
    } catch (err) {
        showToast('❌ Error: ' + err.message);
    }
}

async function deleteLibraryItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
        const res = await fetch(`/api/workspaces/library/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            showToast('🗑️ Deleted');
            loadLibrary();
        }
    } catch (err) {
        showToast('❌ Error: ' + err.message);
    }
}

function viewLibraryItem(id) {
    showToast('🔍 Viewing item...');
}

// ── Document AI Logic ──────────────────────────────────────────────────────
function handleFileSelect(input) {
    const fileName = document.getElementById('file-name');
    if (input.files && input.files[0]) {
        const f = input.files[0];
        fileName.textContent = `📄 ${f.name}`;
        fileName.style.display = 'block';
        // Reset views
        document.getElementById('doc-pages-placeholder').style.display = 'flex';
        document.getElementById('doc-output').innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); text-align:center;">
            <i class="fas fa-brain" style="font-size:48px; opacity:0.15; margin-bottom:16px;"></i>
            <p>Click <strong style="color:var(--primary)">Analyze Document</strong> to start AI analysis</p></div>`;
    }
}

function handleDocDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files && files[0]) {
        const docUpload = document.getElementById('doc-upload');
        // Create a DataTransfer to assign to the file input
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        docUpload.files = dt.files;
        handleFileSelect(docUpload);
    }
}

async function analyzeDocument() {
    const fileInput = document.getElementById('doc-upload');
    const promptInput = document.getElementById('doc-prompt');
    const output = document.getElementById('doc-output');
    const pagesGrid = document.getElementById('doc-pages-grid');
    const placeholder = document.getElementById('doc-pages-placeholder');
    const stats = document.getElementById('doc-stats');
    const analyzeBtn = document.getElementById('analyze-btn');

    if (!fileInput.files[0]) {
        showToast('⚠️ Please upload a document first');
        return;
    }

    // Show loading states
    analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    analyzeBtn.disabled = true;

    output.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--primary); text-align:center;">
        <i class="fas fa-cog fa-spin" style="font-size:40px; margin-bottom:16px;"></i>
        <strong>AI is reading your document...</strong>
        <p style="font-size:12px; color:var(--text-secondary); margin-top:8px;">Extracting text & rendering pages</p>
    </div>`;

    placeholder.style.display = 'flex';
    placeholder.innerHTML = `<div style="color:var(--primary); text-align:center;">
        <i class="fas fa-spinner fa-spin" style="font-size:32px; margin-bottom:12px; display:block;"></i>
        <p>Rendering page previews...</p></div>`;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('prompt', promptInput.value || 'Provide a detailed summary with key points, insights, and takeaways.');

    try {
        const res = await fetch('/api/docs/analyze', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Analysis failed');

        // ── Render page images ──────────────────────────────
        if (data.pageImages && data.pageImages.length > 0) {
            placeholder.style.display = 'none';
            // Clear old pages
            Array.from(pagesGrid.querySelectorAll('.doc-page-thumb')).forEach(el => el.remove());

            data.pageImages.forEach(p => {
                const thumb = document.createElement('div');
                thumb.className = 'doc-page-thumb card-3d';
                thumb.style.cssText = 'background:rgba(0,0,0,0.3); border-radius:12px; overflow:hidden; cursor:pointer; border:1px solid var(--border); transition:0.3s;';
                thumb.innerHTML = `
                    <img src="${p.dataUrl}" style="width:100%; display:block;" loading="lazy">
                    <div style="padding:8px; font-size:11px; text-align:center; color:var(--text-secondary); background:rgba(0,0,0,0.4);">Page ${p.page}</div>`;
                // Click to open full size
                thumb.addEventListener('click', () => {
                    const win = window.open();
                    win.document.write(`<img src="${p.dataUrl}" style="max-width:100%;"><title>Page ${p.page}</title>`);
                });
                thumb.addEventListener('mouseover', () => thumb.style.borderColor = 'var(--primary)');
                thumb.addEventListener('mouseout', () => thumb.style.borderColor = 'var(--border)');
                pagesGrid.appendChild(thumb);
            });

        } else {
            placeholder.innerHTML = `<div style="color:var(--text-secondary); text-align:center;">
                <i class="fas fa-file-alt" style="font-size:48px; opacity:0.15; margin-bottom:16px; display:block;"></i>
                <p style="font-size:13px;">Page previews not available<br><small>(non-PDF or scanned document)</small></p></div>`;
        }

        // ── Show file stats ──────────────────────────────────
        stats.style.display = 'block';
        document.getElementById('doc-stat-name').textContent = `📄 ${data.fileName || fileInput.files[0].name}`;
        document.getElementById('doc-stat-pages').textContent = data.pageImages?.length > 0 ? `🖼️ ${data.pageImages.length} page${data.pageImages.length !== 1 ? 's' : ''} rendered` : '';
        document.getElementById('doc-stat-chars').textContent = data.extractedChars ? `📝 ${data.extractedChars.toLocaleString()} characters extracted` : '';

        // ── Render analysis ──────────────────────────────────
        output.innerHTML = '<div style="white-space:pre-wrap; font-size:14px; line-height:1.8;">' + formatText(data.analysis) + '</div>';
        showToast('✅ Analysis complete!');

    } catch (err) {
        output.innerHTML = `<div style="color:#fca5a5; padding:20px;"><i class="fas fa-exclamation-triangle"></i> Error: ${err.message}</div>`;
        placeholder.innerHTML = `<div style="color:#fca5a5; text-align:center; padding:20px;">Failed to render pages</div>`;
    } finally {
        analyzeBtn.innerHTML = '<i class="fas fa-microscope"></i> Analyze Document';
        analyzeBtn.disabled = false;
    }
}

function copyDocAnalysis() {
    const text = document.getElementById('doc-output').textContent;
    if (!text || text.includes('AI analysis will stream')) return;
    navigator.clipboard.writeText(text).then(() => showToast('📋 Copied!'));
}

function saveDocToLibrary() {
    const text = document.getElementById('doc-output').textContent;
    const file = document.getElementById('doc-upload').files[0];
    if (!text || text.includes('AI analysis will stream')) { showToast('⚠️ Nothing to save yet'); return; }
    saveToLibrary('document', `Analysis: ${file ? file.name : 'Doc'}`, text);
}

// ── Agent Persona Logic ───────────────────────────────────────────────────
function toggleAgentPanel() {
    const p = document.getElementById('agent-panel');
    if (p) {
        p.classList.toggle('show');
        if (p.classList.contains('show')) loadAgents();
    }
}

async function loadAgents() {
    const list = document.getElementById('agent-list');
    list.innerHTML = '<div style="font-size:12px; color:var(--text-secondary); text-align:center;">Loading personas...</div>';

    try {
        const res = await fetch('/api/agents', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        customAgents = await res.json();

        list.innerHTML = `
    <div class="agent-item ${!selectedAgent ? 'active' : ''}" onclick="selectAgent(null)" style="display:flex; align-items:center; gap:12px; padding:10px; border-radius:12px; cursor:pointer; transition:0.3s; background:${!selectedAgent ? 'rgba(139,92,246,0.1)' : 'transparent'};">
       <div class="glass" style="width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fas fa-robot"></i></div>
       <div>
          <div style="font-size:12px; font-weight:700;">NexusAI (Default)</div>
          <div style="font-size:10px; color:var(--text-secondary);">Your standard powerhouse.</div>
       </div>
    </div>
` + customAgents.map(a => `
    <div class="agent-item ${selectedAgent?.id === a.id ? 'active' : ''}" onclick="selectAgent('${a.id}')" style="display:flex; align-items:center; gap:12px; padding:10px; border-radius:12px; cursor:pointer; transition:0.3s; background:${selectedAgent?.id === a.id ? 'rgba(139,92,246,0.1)' : 'transparent'};">
       <div class="glass" style="width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fas fa-${a.icon || 'user-robot'}"></i></div>
       <div>
          <div style="font-size:12px; font-weight:700;">${a.name}</div>
          <div style="font-size:10px; color:var(--text-secondary);">${a.description || 'Persona'}</div>
       </div>
    </div>
`).join('');
    } catch (e) {
        list.innerHTML = 'Error loading agents';
    }
}

function selectAgent(id) {
    if (!id) {
        selectedAgent = null;
        document.getElementById('active-agent-icon').className = 'fas fa-robot';
    } else {
        selectedAgent = customAgents.find(a => a.id === id);
        document.getElementById('active-agent-icon').className = `fas fa-${selectedAgent.icon}`;
    }
    toggleAgentPanel();
    showToast(`🤖 Persona: ${selectedAgent ? selectedAgent.name : 'NexusAI'}`);
}

async function showCreateAgent() {
    const name = prompt("Persona Name (e.g. Code Expert):");
    if (!name) return;
    const systemPrompt = prompt("System Prompt (Instructions for the AI):");
    if (!systemPrompt) return;

    try {
        await apiCall('/api/agents', { name, systemPrompt, description: 'User-created persona' });
        loadAgents();
        showToast('✨ Custom Persona created!');
    } catch (e) {
        showToast('❌ Error: ' + e.message);
    }
}


// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const fill = document.querySelector('.usage-fill');
        if (fill) fill.style.width = '45%';

        // loadChatHistory(); // Optional: depend on data structure
        loadWorkspaces();
        loadLibrary();
    }, 500);

    // Sidebar Active State Toggle
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tool = item.getAttribute('data-tool');
            if (tool) switchTool(tool);
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
});

// ── Audio AI Logic ────────────────────────────────────────────────────────
let selectedAudioFile = null;

function handleAudioUpload(input) {
    if (input.files && input.files[0]) {
        selectedAudioFile = input.files[0];
        const nameEl = document.getElementById('audio-name');
        const sizeEl = document.getElementById('audio-size');
        const info = document.getElementById('audio-file-info');
        const btn = document.getElementById('transcribe-btn');

        if (nameEl && sizeEl && info && btn) {
            nameEl.textContent = selectedAudioFile.name;
            sizeEl.textContent = (selectedAudioFile.size / (1024 * 1024)).toFixed(2) + ' MB';
            info.style.display = 'block';
            btn.style.display = 'flex';
            showToast('🎵 Audio selected');
        }
    }
}

async function runTranscription() {
    if (!selectedAudioFile) return;

    const btn = document.getElementById('transcribe-btn');
    const output = document.getElementById('audio-output');

    if (btn && output) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Transcribing...';
        output.textContent = 'Transcribing your audio using Nexus Whisper Engine...';

        const formData = new FormData();
        formData.append('audio', selectedAudioFile);

        try {
            const res = await fetch('/api/audio/transcribe', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Transcription failed');

            output.textContent = data.text;
            showToast('✅ Transcription Complete');
        } catch (err) {
            showToast('❌ Error: ' + err.message);
            output.textContent = 'Error: ' + err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-waveform-path"></i> Transcribe Audio';
        }
    }
}

function copyAudioTranscript() {
    const output = document.getElementById('audio-output');
    if (output) {
        const text = output.textContent;
        navigator.clipboard.writeText(text);
        showToast('📋 Copied to clipboard');
    }
}

async function summarizeAudio() {
    const output = document.getElementById('audio-output');
    if (!output) return;
    const text = output.textContent;
    if (!text || text.startsWith('Transcription results')) {
        showToast('⚠️ No transcript to summarize');
        return;
    }

    showToast('🧠 Summarizing...');
    try {
        const data = await apiCall('/api/ai/chat', {
            message: "Summarize this transcript concisely highlighting key action items:\n\n" + text,
            history: []
        });

        if (data?.reply) {
            output.textContent = data.reply;
            showToast('✅ Summary Ready');
        }
    } catch (err) {
        showToast('❌ Summarization failed');
    }
}

function sendToChat(type) {
    const output = document.getElementById('audio-output');
    if (!output) return;
    const text = output.textContent;
    if (!text || text.startsWith('Transcription results')) {
        showToast('⚠️ No data to send');
        return;
    }

    switchTool('chat');
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = `Here is the ${type} transcription/analysis:\n\n${text}\n\nPlease help me analyze this further.`;
        // sendMessage(); // Let the user review before sending
        showToast('💬 Added to Chat');
    }
}

// ── PWA & Gestures ──────────────────────────────────────────────────────────
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('PWA: Ready to install');
});

// Gesture Navigation (Native Swipe)
let touchstartX = 0;
let touchendX = 0;

function handleGesture() {
    const threshold = 80; // adjusted for sensitivity
    const tools = ['chat', 'library', 'image', 'audio'];
    const currentIndex = tools.indexOf(currentTool);

    if (touchendX < touchstartX - threshold) {
        // Swipe Left -> Next Tool
        if (currentIndex < tools.length - 1) switchTool(tools[currentIndex + 1]);
    }
    if (touchendX > touchstartX + threshold) {
        // Swipe Right -> Prev Tool
        if (currentIndex > 0) switchTool(tools[currentIndex - 1]);
    }
}

document.addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    handleGesture();
}, false);

// Sync Mobile Nav and Sidebar active states on tool change
document.querySelectorAll('.mob-nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const tool = item.getAttribute('data-tool');
        if (tool) {
            switchTool(tool);
            // switchTool already handles the .mob-nav-item active class toggle
            // Now we sync the sidebar specifically
            document.querySelectorAll('.nav-item').forEach(s => {
                s.classList.toggle('active', s.getAttribute('data-tool') === tool);
            });
        }
    });
});

// ── Enterprise & Phase 19 Logic ─────────────────────────────────────────────

function showSettingsTab(tabId) {
    document.querySelectorAll('.settings-tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('#settings-tabs button').forEach(b => b.classList.remove('active'));

    document.getElementById(`tab-${tabId}`).style.display = 'block';
    event.currentTarget.classList.add('active');
}

let currentAPIKey = 'nexus_sk_live_q8k2m9p1s0x4v5w6y7z8';

function generateAPIKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let newKey = 'nexus_sk_live_';
    for (let i = 0; i < 20; i++) newKey += chars.charAt(Math.floor(Math.random() * chars.length));
    currentAPIKey = newKey;
    document.getElementById('api-key-display').value = newKey;
    showToast('🔑 New API Key Generated');
}

function toggleKeyVisibility() {
    const input = document.getElementById('api-key-display');
    const icon = event.currentTarget.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        input.value = currentAPIKey;
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function copyAPIKey() {
    const input = document.getElementById('api-key-display');
    navigator.clipboard.writeText(currentAPIKey);
    showToast('📋 API Key Copied');
}

async function exportDocData(format) {
    const output = document.getElementById('doc-output');
    if (!output || output.textContent.includes('AI analysis will stream here')) {
        showToast('⚠️ No data to export');
        return;
    }

    showToast(`📊 Structure Data to ${format.toUpperCase()}...`);
    const content = output.textContent;

    try {
        const data = await apiCall('/api/ai/chat', {
            message: `Convert the following document analysis into a strictly formatted ${format.toUpperCase()} table. Only return the ${format.toUpperCase()} code block.\n\nContent: ${content}`,
            history: []
        });

        if (data?.reply) {
            const blob = new Blob([data.reply], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nexus_export_${Date.now()}.${format}`;
            a.click();
            showToast('✅ Export Successful');
        }
    } catch (err) {
        showToast('❌ Export failed');
        console.error(err);
    }
}

// ── Vision Engine Logic ──────────────────────────────────────────────────
function handleVisionImage(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Resize logic - Max 512px for Vision to guarantee token safety
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const max = 512; // More aggressive optimization

            if (width > height) {
                if (width > max) {
                    height *= max / width;
                    width = max;
                }
            } else {
                if (height > max) {
                    width *= max / height;
                    height = max;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Ultra-optimized for API payload (50% quality JPEG)
            currentVisionImage = canvas.toDataURL('image/jpeg', 0.5);
            document.getElementById('vision-thumbnail').style.backgroundImage = `url(${currentVisionImage})`;
            document.getElementById('vision-preview-container').style.display = 'flex';
            showToast('📸 Image optimized for analysis (Ultra Settings)');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function clearVisionImage() {
    currentVisionImage = null;
    document.getElementById('vision-upload').value = '';
    document.getElementById('vision-preview-container').style.display = 'none';
}
function toggleKnowledgeSync() {
    knowledgeSyncActive = !knowledgeSyncActive;
    const btn = document.getElementById('knowledge-toggle');
    const icon = btn.querySelector('i');

    if (knowledgeSyncActive) {
        icon.classList.add('memory-active');
        showToast('🧠 Nexus Memory Connected');
    } else {
        icon.classList.remove('memory-active');
        showToast('🧠 Memory Disconnected');
    }
}

async function getKnowledgeContext(query) {
    if (!knowledgeSyncActive) return "";

    const status = document.getElementById('knowledge-status');
    status.classList.add('show');

    try {
        const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        return data.context || "";
    } catch (e) {
        console.error('Knowledge fetch failed:', e);
        return "";
    } finally {
        status.classList.remove('show');
    }
}

// ── Web Intelligence Logic ──────────────────────────────────────────────
function toggleWebSearch() {
    webSearchActive = !webSearchActive;
    const btn = document.getElementById('web-toggle');
    const icon = btn.querySelector('i');

    if (webSearchActive) {
        icon.classList.add('web-active');
        showToast('🌐 Web Intelligence Connected');
    } else {
        icon.classList.remove('web-active');
        showToast('🌐 Web Disconnected');
    }
}

async function getWebContext(query) {
    if (!webSearchActive) return "";

    // Check if the user mentioned a URL to crawl
    const urlMatch = query.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
        showToast('🕷️ Crawling URL...');
        try {
            const res = await fetch('/api/web/crawl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url: urlMatch[0] })
            });
            const data = await res.json();
            return `[Live Web Data from ${urlMatch[0]}]: ${data.content}`;
        } catch (e) { return ""; }
    }

    // Normal search simulation
    showToast('🔍 Searching Web...');
    try {
        const res = await fetch(`/api/web/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        return data.results.map(r => `[Search Source]: ${r.title} - ${r.snippet}`).join('\n');
    } catch (e) { return ""; }
}

// ── Preferences Management ────────────────────────────────────────────────
async function savePreferences() {
    const prefs = {
        codingLanguage: document.getElementById('pref-lang').value,
        industry: document.getElementById('pref-industry').value,
        tone: document.getElementById('pref-tone').value
    };

    try {
        await fetch('/api/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ preferences: prefs })
        });
        showToast('✅ Nexus Memory Updated');
    } catch (e) {
        showToast('❌ Failed to save memory');
    }
}

async function loadPreferences() {
    try {
        const res = await fetch('/api/preferences', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const prefs = data.preferences;
        if (prefs) {
            if (document.getElementById('pref-lang')) document.getElementById('pref-lang').value = prefs.codingLanguage;
            if (document.getElementById('pref-industry')) document.getElementById('pref-industry').value = prefs.industry;
            if (document.getElementById('pref-tone')) document.getElementById('pref-tone').value = prefs.tone;
        }
    } catch (e) { console.error('Pref load failed:', e); }
}

// ── Command Center Logic ──────────────────────────────────────────────
async function generateAutomation(type) {
    showToast(`🤖 AI is generating ${type} script...`);

    // Switch to chat tool automatically to show the response
    switchTool('chat');

    // Send a specialized message to the AI
    const prompt = `COMMAND CENTER: Generate an automation script for "${type}". 
    Format it as a professional script (e.g., .bat, .ps1, or .sh) with comments explaining each step.
    Ensure it is safe and highly optimized.`;

    sendMessage(prompt, true);
}

// Ensure prefs load when settings open
const originalShowSettings = window.showSettings || function () { document.getElementById('settings-modal').classList.add('show'); };
window.showSettings = () => {
    originalShowSettings();
    loadPreferences();
};



// Check for successful payment redirect
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        const plan = urlParams.get('plan');
        showToast(`🎉 Payment successful! You are now on the ${plan.toUpperCase()} plan!`, 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('payment') === 'cancelled') {
        showToast('Payment cancelled.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});
