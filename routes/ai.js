const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middleware/auth');
const { deductCredits } = require('../middleware/credits');

// Initialize Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Chats Storage
const CHATS_FILE = path.join(__dirname, '../data/chats.json');
const readChats = () => {
    if (!fs.existsSync(CHATS_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'));
    } catch (e) { return []; }
};
const writeChats = (data) => fs.writeFileSync(CHATS_FILE, JSON.stringify(data, null, 2));

// Helper for Groq calls
async function getGroqCompletion(messages, model = "llama-3.3-70b-versatile", temperature = 0.7) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages,
            model,
            temperature,
            max_tokens: 4096,
            top_p: 1,
            stream: false,
        });
        return chatCompletion.choices[0]?.message?.content || "";
    } catch (error) {
        console.error('Groq API Error:', error);
        throw new Error('AI request failed. ' + (error.message || ''));
    }
}

// ── AI Chat ────────────────────────────────────────────────────────────────
router.get('/chat/history', verifyToken, (req, res) => {
    try {
        const chats = readChats();
        const userChats = chats.filter(c => c.userId === req.user.id);
        res.json(userChats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/chat', verifyToken, async (req, res) => {
    try {
        const { message, history, agentSystemPrompt, imageData } = req.body;

        // Deduct Credits
        const type = imageData ? 'vision' : 'chat';
        const hasCredits = await deductCredits(req.user.id, type);
        if (!hasCredits) return res.status(402).json({ error: 'Insufficient credits. Please upgrade your plan.' });

        // Load Persistent Preferences for personalization
        const PREF_PATH = path.join(__dirname, '../data/preferences.json');
        let memoryPrompt = "";
        try {
            if (fs.existsSync(PREF_PATH)) {
                const prefs = JSON.parse(fs.readFileSync(PREF_PATH, 'utf8')).preferences;
                if (prefs) {
                    memoryPrompt = `User Preferences (Nexus Memory): Industry: ${prefs.industry || 'Any'}, Language: ${prefs.codingLanguage || 'English'}, Preferred Tone: ${prefs.tone || 'Professional'}.`;
                }
            }
        } catch (e) { /* ignore */ }

        const basePrompt = agentSystemPrompt || "You are NexusAI, a highly intelligent and helpful AI assistant.";
        const finalSystemPrompt = memoryPrompt ? `${basePrompt}\n\n[Long-Term Context] ${memoryPrompt}` : basePrompt;

        const messages = [
            { role: "system", content: finalSystemPrompt },
            ...(history || []).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text })),
            {
                role: "user",
                content: imageData
                    ? [
                        { type: "text", text: message },
                        { type: "image_url", image_url: { url: imageData } }
                    ]
                    : message
            }
        ];

        // Use vision model if image is present
        const model = imageData ? "llama-3.2-90b-vision-preview" : "llama-3.3-70b-versatile";

        const reply = await getGroqCompletion(messages, model);

        // Persist to history
        const chats = readChats();
        chats.push({
            id: Date.now().toString(),
            userId: req.user.id,
            role: 'user',
            text: message,
            timestamp: new Date().toISOString()
        });
        chats.push({
            id: (Date.now() + 1).toString(),
            userId: req.user.id,
            role: 'assistant',
            text: reply,
            timestamp: new Date().toISOString()
        });
        writeChats(chats);

        res.json({ reply });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Content Writer ─────────────────────────────────────────────────────────
router.post('/content', verifyToken, async (req, res) => {
    try {
        const { type, topic, tone, length } = req.body;

        const hasCredits = await deductCredits(req.user.id, 'chat');
        if (!hasCredits) return res.status(402).json({ error: 'Insufficient credits.' });

        const prompt = `Write a ${tone} ${type} about "${topic}" in approximately ${length} words. Focus on being engaging and high-quality.`;

        const messages = [
            { role: "system", content: "You are an expert content writer. You generate viral, high-quality content that engages readers." },
            { role: "user", content: prompt }
        ];

        const content = await getGroqCompletion(messages);
        res.json({ content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Image Prompt Generator ─────────────────────────────────────────────────
router.post('/image-prompt', verifyToken, async (req, res) => {
    try {
        const { concept, style, platform } = req.body;

        const hasCredits = await deductCredits(req.user.id, 'chat');
        if (!hasCredits) return res.status(402).json({ error: 'Insufficient credits.' });

        const prompt = `Generate 3 distinct, highly detailed ${platform} prompts for the concept: "${concept}" in a "${style}" style. Format as a simple list.`;

        const messages = [
            { role: "system", content: "You are an expert prompt engineer for Midjourney, DALL-E, and Stable Diffusion. You create specific, technical prompts that result in stunning images." },
            { role: "user", content: prompt }
        ];

        const raw = await getGroqCompletion(messages, "llama-3.1-8b-instant");
        const prompts = raw.split(/\d\.\s+/).filter(p => p.trim().length > 10).map(p => p.trim());

        res.json({ prompts: prompts.slice(0, 3) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Code Helper ────────────────────────────────────────────────────────────
router.post('/code', verifyToken, async (req, res) => {
    try {
        const { language, taskType, description } = req.body;

        const hasCredits = await deductCredits(req.user.id, 'chat');
        if (!hasCredits) return res.status(402).json({ error: 'Insufficient credits.' });

        const prompt = `Write ${language} code for the following task: "${description}". The goal is to ${taskType}. Provide ONLY the code block.`;

        const messages = [
            { role: "system", content: "You are an expert senior software engineer. You write clean, optimized, and secure code. Provide only the code, no preamble." },
            { role: "user", content: prompt }
        ];

        const code = await getGroqCompletion(messages);
        res.json({ code });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── SEO Optimizer ──────────────────────────────────────────────────────────
router.post('/seo', verifyToken, async (req, res) => {
    try {
        const { keyword, content } = req.body;

        const hasCredits = await deductCredits(req.user.id, 'seo');
        if (!hasCredits) return res.status(402).json({ error: 'Insufficient credits.' });

        const prompt = `Analyze this content for the keyword "${keyword}":\n\n${content}\n\nProvide: SEO score (0-100), keyword_density, search_intent, competition (Low/Med/High), 5 LSI keywords, 3 recommendations, meta_title, and meta_description. RETURN AS JSON ONLY.`;

        const messages = [
            { role: "system", content: "You are an SEO expert. You analyze content for search engine performance and provide actionable JSON data. Format: {score, keyword_density, search_intent, competition, lsi_keywords[], recommendations[], meta_title, meta_description}" },
            { role: "user", content: prompt }
        ];

        const rawJson = await getGroqCompletion(messages);
        const match = rawJson.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("AI returned invalid JSON for SEO analysis");
        const data = JSON.parse(match[0]);

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Image Generation (Pollinations AI — Server-side Proxy) ──────────────
// ── Image Generation (Pollinations AI — URL Provider) ──────────────────
router.post('/generate-image', verifyToken, async (req, res) => {
    const { prompt } = req.body;

    const hasCredits = await deductCredits(req.user.id, 'image');
    if (!hasCredits) return res.status(402).json({ error: 'Insufficient credits.' });

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'A prompt is required' });
    }

    const seed = Math.floor(Math.random() * 9999999) + 1;
    const cleanPrompt = prompt.trim();

    // UNIVERSAL AUTO-ENHANCEMENT: World-class photography for ANY subject
    const enhancedPrompt = `${cleanPrompt}, hyper-realistic professional photography, 8k UHD, cinematic masterpiece, extremely detailed, sharp focus, stunning composition, high dynamic range, award-winning shot`;
    const encodedPrompt = encodeURIComponent(enhancedPrompt);

    // Provide multiple high-fidelity Flux-compatible endpoints
    const urls = {
        primary: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux&enhance=true`,
        secondary: `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`,
        tertiary: `https://gen.pollinations.ai/image/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}&turbo=true`
    };

    console.log(`[Image] URL requested for: "${cleanPrompt}"`);
    res.json({ urls, prompt: cleanPrompt });
});

module.exports = router;
