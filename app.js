/* ─── NexusAI App Logic ─── */

// ── State ──
let currentTool = 'chat';
let currentTone = 'professional';
let currentStyle = 'photorealistic';
const chatHistory = [];

const toolMeta = {
    chat: { title: 'AI Chat', sub: 'Ask anything. Get instant AI-powered answers.' },
    writer: { title: 'Content Writer', sub: 'Generate high-quality content in seconds.' },
    image: { title: 'Image Prompt AI', sub: 'Craft perfect prompts for any AI image generator.' },
    code: { title: 'Code Helper', sub: 'Generate, debug, and explain code instantly.' },
    seo: { title: 'SEO Optimizer', sub: 'Get AI-powered SEO recommendations for your content.' },
};

// ── Tool Switcher ──
function switchTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('tool-' + tool).classList.add('active');
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    const meta = toolMeta[tool];
    document.getElementById('page-title').textContent = meta.title;
    document.getElementById('page-subtitle').textContent = meta.sub;
}

// ── Chat ──
function handleChatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function sendSuggestion(text) {
    document.getElementById('chat-input').value = text;
    sendMessage();
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const welcome = document.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    appendMsg('user', 'A', text);
    input.value = '';
    input.style.height = 'auto';
    chatHistory.push({ role: 'user', text });
    showTyping();

    setTimeout(() => {
        removeTyping();
        const reply = getAIReply(text);
        appendMsg('assistant', '🤖', reply);
        chatHistory.push({ role: 'assistant', text: reply });
    }, 1200 + Math.random() * 800);
}

function appendMsg(role, avatar, text) {
    const messages = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">${formatText(text)}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function showTyping() {
    const messages = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg assistant';
    div.id = 'typing-msg';
    div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div>
    </div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function removeTyping() {
    const t = document.getElementById('typing-msg');
    if (t) t.remove();
}

function formatText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^• (.+)/gm, '<li>$1</li>')
        .replace(/^\d+\. (.+)/gm, '<li>$1</li>')
        .replace(/\n/g, '<br/>');
}

// ── AI Replies (Smart pattern matching) ──
const responses = [
    {
        match: /(youtube|video idea|viral)/i,
        reply: `🔥 Here are **5 viral YouTube video ideas for 2026**:\n\n1. **"I built a SaaS in 24 hours — Here's what happened"** — behind-the-scenes coding vlogs are exploding\n2. **"AI tools I use to make $10,000/month"** — high intent, monetizable audience\n3. **"ChatGPT vs Gemini vs Claude — REAL comparison 2026"** — evergreen comparison content\n4. **"I tried 30 days of AI-only work — shocking results"** — challenge + experiment format\n5. **"How to start a no-code AI SaaS with $0"** — massive demand for this content\n\nPro tip: Start every video with a **hook in the first 5 seconds** — "You won't believe what this AI tool can do..."`
    },
    {
        match: /(cold email|saas customer|first customer)/i,
        reply: `Here's a **high-converting cold email template** for getting your first SaaS customer:\n\n---\n**Subject:** Quick question about [their pain point]\n\nHi [Name],\n\nI noticed you're [specific observation about their business].\n\nMost [their job title]s I talk to struggle with [pain point]. That's exactly why I built [Your SaaS] — it helps [specific outcome] in [timeframe].\n\n[Customer name] used it to [specific result, e.g., save 5 hours/week].\n\nWould it be worth a 15-min call to see if it could do the same for you?\n\n[Your name]\n\n---\n💡 **Key tips**: personalize every email, keep it under 120 words, and always end with one clear CTA.`
    },
    {
        match: /(10k|10,000|grow.*saas|saas.*grow)/i,
        reply: `Here's the **proven path to $10K/month** for an AI SaaS:\n\n**Phase 1 — Traction (0 to $1K)**\n• Launch on Product Hunt, Hacker News, Reddit\n• Do 50 outbound DMs/emails per day\n• Obsess over your first 10 users\n\n**Phase 2 — Growth ($1K to $5K)**\n• Build a content flywheel (Twitter/X + YouTube + SEO blog)\n• Set up affiliate program (20-30% commission)\n• Ask every user for referrals\n\n**Phase 3 — Scale ($5K to $10K+)**\n• Launch on AppSumo for a cash injection\n• Add annual pricing (1 month free)\n• Hire a part-time growth person\n\n📊 Key metric: **focus on reducing churn first**, then acquisition.`
    },
    {
        match: /(ai agent|explain ai)/i,
        reply: `Great question! Here's **AI Agents explained simply**:\n\n🤖 **What is an AI Agent?**\nAn AI agent is an AI that can **take actions** — not just answer questions. It can browse the web, write code, send emails, and more — all on its own.\n\n**Traditional AI:** You ask → AI answers → Done\n**AI Agent:** You give a goal → AI plans → AI takes steps → AI delivers results\n\n**Real examples:**\n• \`AutoGPT\` — browses web, writes files autonomously\n• \`Devin\` — codes entire software features alone\n• \`NexusAI\` — your AI co-pilot for content & growth 🚀\n\n**Why it matters:** AI agents are the next wave after chatbots. They can automate entire workflows that previously needed human workers.`
    },
    {
        match: /(million|rich|money|wealth)/i,
        reply: `💰 **The fastest paths to $1M in 2026:**\n\n1. **AI SaaS** — Build a niche AI tool, charge $29-99/month. 1,000 users = $1M+/year\n2. **Content + Monetization** — YouTube/newsletter with affiliate revenue\n3. **Freelancing → Agency** — Start solo, build a team, scale to $50K+/month\n4. **Digital Products** — Courses, templates, ebooks — create once, sell forever\n\n**The formula:** Solve a **specific problem** for a **specific person** and **charge what it's worth**.\n\nRemember: your first $1M is hardest. After that, compounding takes over. 📈`
    }
];

function getAIReply(text) {
    for (const r of responses) {
        if (r.match.test(text)) return r.reply;
    }
    // Generic smart fallback
    const generic = [
        `That's a great topic! Here's what I know about **${text.substring(0, 40)}...**\n\n**Key insights:**\n• The AI space is moving extremely fast in 2026 — staying ahead is crucial\n• Focus on **solving real problems** rather than chasing trends\n• Start small, validate quickly, and iterate based on feedback\n\nWould you like me to go deeper on any specific aspect? I can help with strategy, content, code, or business planning! 🚀`,
        `**Here's my take on "${text.substring(0, 35)}...":**\n\nThis is one of the most interesting areas to explore right now. The opportunity is massive for those who act early.\n\n**My recommendation:**\n1. Start with research — understand the market deeply\n2. Find your unique angle — don't copy, innovate\n3. Build an MVP fast — done is better than perfect\n4. Get feedback from 10 real users before scaling\n\nNeed help building a specific part of this? Let me know! 💡`,
        `Great question! Let me break this down for you.\n\n**Short answer:** Yes, this is absolutely worth pursuing in 2026.\n\n**Longer answer:** The key is to approach it strategically. Most people fail not because of a bad idea, but because of poor execution and giving up too early.\n\n**Action steps:**\n• Define your target user in 1 sentence\n• Identify their #1 pain point\n• Build the smallest possible solution to that pain\n• Charge for it from day 1\n\nWant me to help you map out a full action plan? 🎯`,
    ];
    return generic[Math.floor(Math.random() * generic.length)];
}

// ── Content Writer ──
let writerTone = 'professional';
function setTone(btn, tone) {
    writerTone = tone;
    document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

const contentTemplates = {
    blog: (topic, tone) => `# ${capitalize(topic)}: The Complete Guide for 2026\n\n## Introduction\n\nIn today's rapidly evolving digital landscape, ${topic} has become one of the most critical factors for success. Whether you're a seasoned professional or just getting started, understanding the nuances of this subject can make or break your results.\n\n## Why ${capitalize(topic)} Matters Now More Than Ever\n\nThe landscape has shifted dramatically. Here's what you need to know:\n\n• **The opportunity is massive** — Early movers are seeing 10x returns\n• **The barrier to entry is lower** than most think\n• **Those who wait will be left behind** — This trend isn't slowing down\n\n## Step-by-Step Action Plan\n\n### Step 1: Foundation Building\nBefore diving deep, establish your baseline. Map out your current situation and identify exactly where you want to be in 90 days.\n\n### Step 2: Strategy & Execution\nMost people skip this step. Don't. A well-defined strategy is the difference between consistent progress and random results.\n\n### Step 3: Scale What Works\nOnce you've validated your approach, double down. Remove what doesn't work and amplify what does.\n\n## Common Mistakes to Avoid\n\n1. **Skipping validation** — Always test before committing fully\n2. **Perfectionism paralysis** — Done beats perfect every time\n3. **Ignoring data** — Let numbers guide your decisions\n\n## Conclusion\n\nMastering ${topic} in 2026 is not just an option — it's a necessity. Start today, stay consistent, and the results will follow.\n\n*Ready to take the next step? Start with just one small action today.*`,

    social: (topic, tone) => `🔥 Hot take on ${topic}:\n\nMost people are doing it completely wrong.\n\nHere's what actually works in 2026 👇\n\n1️⃣ Stop overthinking. Start doing.\n2️⃣ Focus on ONE thing at a time\n3️⃣ Consistency > Intensity. Every. Single. Time.\n\nI've seen people go from 0 to $10K/month just by mastering ${topic}.\n\nThe secret? They didn't wait for the perfect moment.\n\nThey started messy and improved along the way.\n\n💬 What's your biggest challenge with ${topic}? Drop it below! ⬇️\n\n#AI #Growth #${topic.replace(/\s+/g, '')} #Entrepreneurship #2026`,

    email: (topic, tone) => `Subject: The ${capitalize(topic)} strategy that changes everything\n\nHey [First Name],\n\nI'm going to get straight to the point.\n\nMost businesses are leaving massive money on the table when it comes to ${topic}.\n\nAnd I don't want that to be you.\n\nHere's what I've discovered after working with 100+ businesses:\n\n→ The #1 mistake is [specific mistake]\n→ The fix is surprisingly simple\n→ Results can happen within [timeframe]\n\nI've put together a complete breakdown of how to get this right.\n\nNo fluff. No filler. Just what works.\n\n[→ Click here to see the full strategy]\n\nTalk soon,\n[Your Name]\n\nP.S. This strategy helped [Company] achieve [specific result] in just [timeframe]. Worth a look.`,

    ad: (topic, tone) => `⚡ ATTENTION: ${capitalize(topic)} is changing everything in 2026\n\n✅ Save 10+ hours per week\n✅ Results in 48 hours or less\n✅ Trusted by 10,000+ professionals\n\n"This completely transformed how I work" — Sarah K., CEO\n\n🎯 Limited spots available. Don't miss out.\n\n[Start Free Trial →]`,

    linkedin: (topic, tone) => `I never thought ${topic} would change my business this dramatically.\n\nHere's my honest story:\n\n6 months ago, I was struggling with [pain point].\nI was working 70-hour weeks. Revenue was flat. I was burning out.\n\nThen I discovered a different approach to ${topic}.\n\nWithin 30 days:\n→ Revenue up 40%\n→ Working 45 hours/week\n→ Actually enjoying my work again\n\nHere's exactly what I changed:\n\n1. [Step 1 — Specific action]\n2. [Step 2 — Specific action]\n3. [Step 3 — Specific action]\n\nThe biggest lesson? ${capitalize(topic)} isn't about working harder. It's about working smarter with the right systems.\n\nWhat's YOUR biggest challenge with this right now?\n\n↓ Tell me in the comments`,

    youtube: (topic, tone) => `🔥 ${capitalize(topic)} — Everything You Need to Know in 2026\n\nIn this video, I'll show you exactly how to master ${topic} from scratch — even if you're starting with zero experience.\n\n⏱️ TIMESTAMPS:\n00:00 — Introduction & What You'll Learn\n01:30 — Why ${capitalize(topic)} Matters in 2026\n04:15 — Common Mistakes (Avoid These!)\n08:00 — Step-by-Step Strategy\n15:00 — Real Results & Case Studies\n20:30 — Free Resources & Next Steps\n\n📚 FREE RESOURCES MENTIONED:\n→ Download the free ${topic} checklist: [link]\n→ Join our community: [link]\n\n👍 If this helped you, LIKE & SUBSCRIBE for more content every week!\n\n#${topic.replace(/\s+/g, '')} #Tutorial #2026`
};

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function generateContent() {
    const type = document.getElementById('content-type').value;
    const topic = document.getElementById('writer-topic').value.trim() || 'AI tools for 2026';
    const output = document.getElementById('writer-output');
    output.classList.add('generating');
    output.textContent = '✨ Generating your content...';

    setTimeout(() => {
        output.classList.remove('generating');
        const content = contentTemplates[type]
            ? contentTemplates[type](topic, writerTone)
            : `Generated content about "${topic}" in ${type} format with ${writerTone} tone.`;
        output.textContent = content;
        const wc = content.split(/\s+/).filter(Boolean).length;
        document.getElementById('word-count').textContent = `${wc} words generated`;
        showToast('✅ Content generated!');
    }, 1500);
}

function regenerateContent() { generateContent(); }

function copyOutput() {
    const text = document.getElementById('writer-output').textContent;
    if (!text || text.includes('Your AI-generated')) return;
    navigator.clipboard.writeText(text).then(() => showToast('📋 Copied to clipboard!'));
}

// ── Image Prompt Generator ──
function setStyle(btn, style) {
    currentStyle = style;
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

const imagePromptTemplates = {
    'photorealistic': (concept) => [
        `${concept}, hyperrealistic photograph, shot on Sony A7R V, 85mm f/1.4 lens, golden hour lighting, shallow depth of field, ultra detailed, 8K resolution, award-winning photography --ar 16:9 --v 6`,
        `Photorealistic ${concept}, cinematic composition, HDR, dramatic shadows, studio lighting, crisp details, professional photographer, National Geographic quality --ar 3:2 --v 6 --style raw`
    ],
    'anime': (concept) => [
        `${concept}, anime style, studio Ghibli inspired, soft watercolor background, detailed character design, vibrant colors, manga panel composition, by Makoto Shinkai --ar 16:9 --niji 6`,
        `${concept}, anime digital art, cel shaded, clean line art, dynamic pose, pastel color palette, light bloom effects, epic scale --niji 6 --style expressive`
    ],
    'oil-painting': (concept) => [
        `${concept}, oil painting, baroque style, impasto technique, Rembrandt lighting, rich jewel tones, museum quality, fine art, highly detailed brushwork --ar 4:3 --v 6`,
        `${concept}, classic oil painting, impressionist style inspired by Monet, visible brushstrokes, warm palette, soft light, gallery masterpiece --v 6 --style raw`
    ],
    '3d-render': (concept) => [
        `${concept}, 3D render, Cinema 4D, octane renderer, photorealistic materials, studio HDRI lighting, subsurface scattering, global illumination, 8K textures, ultra-detailed --ar 1:1 --v 6`,
        `${concept}, Blender 3D render, stylized low-poly art, isometric view, soft pastel colors, ambient occlusion, clean shadows, trending on ArtStation --v 6`
    ],
    'watercolor': (concept) => [
        `${concept}, delicate watercolor painting, soft color bleeding, paper texture visible, loose brushwork, dreamy atmosphere, botanical illustration style, by James Gurney --ar 3:4 --v 6`,
        `${concept}, watercolor and ink, Japanese style, minimalist composition, negative space, washi paper texture, indigo and coral palette --v 6 --style raw`
    ],
    'cyberpunk': (concept) => [
        `${concept}, cyberpunk aesthetic, neon lights, rain-slicked streets, holographic billboards, dystopian megacity, purple and cyan color scheme, volumetric fog, by Blade Runner 2049 --ar 21:9 --v 6`,
        `${concept}, cyberpunk underground, biopunk elements, glowing implants, dark alley, neon signs in Japanese, retrofuturistic, ultra detailed, cinematic --v 6 --style cinematic`
    ]
};

function generateImagePrompt() {
    const concept = document.getElementById('image-concept').value.trim() || 'a magical forest at twilight';
    const platform = document.getElementById('img-platform').value;
    const results = document.getElementById('prompt-results');
    const prompts = imagePromptTemplates[currentStyle]
        ? imagePromptTemplates[currentStyle](concept)
        : [`Detailed ${currentStyle} style image of: ${concept}, highly detailed, professional quality`];

    results.innerHTML = '';
    prompts.forEach((p, i) => {
        setTimeout(() => {
            const card = document.createElement('div');
            card.className = 'prompt-card';
            card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:11px;background:rgba(124,58,237,0.2);color:#a78bfa;padding:3px 10px;border-radius:20px;border:1px solid rgba(124,58,237,0.3);">${platform} Prompt ${i + 1}</span>
        </div>
        <p>${p}</p>
        <button class="sm-btn copy-prompt" onclick="copyPrompt(this, \`${p.replace(/`/g, "'")}\`)">📋 Copy</button>`;
            results.appendChild(card);
        }, i * 300);
    });
    showToast('🎨 Prompts generated!');
}

function copyPrompt(btn, text) {
    navigator.clipboard.writeText(text).then(() => showToast('📋 Prompt copied!'));
}

// ── Code Helper ──
const codeExamples = {
    'Generate Code': {
        JavaScript: (prompt) => `// AI Generated Code — NexusAI
// Task: ${prompt}

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-here';

// User Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user in database (replace with actual DB query)
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Protected route example
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({ message: 'Protected data', user: req.user });
});

app.listen(3000, () => console.log('🚀 Server running on port 3000'));`,

        Python: (prompt) => `# AI Generated Code — NexusAI
# Task: ${prompt}

from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
import bcrypt
from datetime import datetime, timedelta

app = FastAPI(title="NexusAI API", version="1.0.0")
security = HTTPBearer()
SECRET_KEY = "your-secret-key-change-in-production"

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user_id: str
    email: str

def create_token(user_id: str, email: str) -> str:
    """Generate a JWT access token."""
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT and return user data."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    # Replace with actual database lookup
    user = await get_user_by_email(request.email)
    if not user or not bcrypt.checkpw(request.password.encode(), user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user.id, user.email)
    return LoginResponse(token=token, user_id=user.id, email=user.email)

@app.get("/api/profile")
async def get_profile(user: dict = Depends(verify_token)):
    return {"message": "Protected!", "user": user}`,
    }
};

function generateCode() {
    const lang = document.getElementById('code-lang').value;
    const task = document.getElementById('code-task').value;
    const prompt = document.getElementById('code-prompt').value.trim() || 'user authentication system with JWT';
    const output = document.getElementById('code-output');
    output.innerHTML = '<code class="code-placeholder">⚡ Generating code...</code>';

    setTimeout(() => {
        let code;
        if (codeExamples['Generate Code']?.[lang]) {
            code = codeExamples['Generate Code'][lang](prompt);
        } else {
            code = `// AI Generated Code (${lang})\n// Task: ${task} — ${prompt}\n\n// Nexus AI is analyzing your request...\n// Generating optimized ${lang} code...\n\nfunction nexusGenerated() {\n  // Implementation for: ${prompt}\n  // Language: ${lang}\n  // Start with defining your data structures,\n  // then implement the core logic,\n  // and finally add error handling.\n  \n  console.log("NexusAI-generated code ready!");\n}\n\nnexusGenerated();`;
        }
        output.textContent = code;
        showToast('⚡ Code generated!');
    }, 1400);
}

function copyCode() {
    const code = document.getElementById('code-output').textContent;
    if (code.includes('will appear here')) return;
    navigator.clipboard.writeText(code).then(() => showToast('📋 Code copied!'));
}

// ── SEO Tool ──
function runSEO() {
    const keyword = document.getElementById('seo-keyword').value.trim() || 'AI tools 2026';
    const content = document.getElementById('seo-content').value.trim();
    const results = document.getElementById('seo-results');

    results.innerHTML = '<div style="color:var(--accent);font-size:14px;padding:16px;">🔍 Analyzing your content...</div>';

    setTimeout(() => {
        const score = content.length > 100 ? 78 : 42;
        const scoreClass = score > 70 ? 'score-good' : score > 50 ? 'score-warn' : 'score-bad';
        const scoreIcon = score > 70 ? '✅' : score > 50 ? '⚠️' : '❌';

        results.innerHTML = `
      <div class="seo-card">
        <h4>📊 Overall SEO Score</h4>
        <div class="seo-score ${scoreClass}">${scoreIcon} ${score}/100</div>
        <p style="color:var(--text-secondary);font-size:13px">Your content is ${score > 70 ? 'well optimized' : 'needs improvement'} for the keyword "${keyword}".</p>
      </div>
      <div class="seo-card">
        <h4>🔑 Keyword Analysis</h4>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-secondary)">
          <div>• Target keyword: <strong style="color:var(--text-primary)">"${keyword}"</strong></div>
          <div>• Keyword density: <span style="color:var(--green)">2.3% (optimal)</span></div>
          <div>• Search intent match: <span style="color:var(--green)">Informational ✓</span></div>
          <div>• Monthly searches: <strong style="color:var(--text-primary)">~14,800</strong></div>
          <div>• Competition: <span style="color:var(--orange)">Medium</span></div>
        </div>
      </div>
      <div class="seo-card">
        <h4>💡 AI Recommendations</h4>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-secondary)">
          <div>✅ Add "${keyword}" in your H1 heading</div>
          <div>✅ Include 3-5 LSI keywords: <em>AI software, machine learning tools, automation 2026</em></div>
          <div>${content.length > 500 ? '✅' : '⚠️'} Content length: ${content.length > 500 ? 'Good (500+ words)' : 'Too short — aim for 1,500+ words'}</div>
          <div>⚠️ Add structured data (FAQ schema) to boost CTR</div>
          <div>✅ Add internal links to related content</div>
          <div>⚠️ Optimize meta description to include "${keyword}"</div>
        </div>
      </div>
      <div class="seo-card">
        <h4>🏆 Suggested Meta Tags</h4>
        <div style="background:#0d1117;border-radius:8px;padding:12px;font-size:12.5px;font-family:monospace;color:#e6edf3;margin-top:4px">
          &lt;title&gt;${capitalize(keyword)} — Complete Guide 2026&lt;/title&gt;<br/>
          &lt;meta name="description" content="Discover the best ${keyword} strategies in 2026. Expert tips, actionable advice, and proven results."&gt;<br/>
          &lt;meta name="keywords" content="${keyword}, AI tools, automation 2026, machine learning"&gt;
        </div>
      </div>`;
        showToast('✅ SEO analysis complete!');
    }, 1800);
}

// ── Upgrade Modal ──
function showUpgrade() {
    document.getElementById('upgrade-modal').classList.add('show');
}
function hideUpgrade() {
    document.getElementById('upgrade-modal').classList.remove('show');
}

// ── Toast ──
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Init ──
window.addEventListener('DOMContentLoaded', () => {
    // Animate usage bar
    setTimeout(() => {
        document.querySelector('.usage-fill').style.width = '45%';
    }, 500);
});
