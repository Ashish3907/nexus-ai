const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Simple JSON file as a database (replace with real DB later)
const DB_PATH = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
    try {
        if (!fs.existsSync(path.dirname(DB_PATH))) {
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        }
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify([]));
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch { return []; }
}

function saveUsers(users) {
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role },
        process.env.JWT_SECRET || 'nexusai-secret',
        { expiresIn: '7d' }
    );
}

// ── POST /api/auth/register ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        const users = loadUsers();
        if (users.find(u => u.email === email.toLowerCase())) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        const hash = await bcrypt.hash(password, 10);
        const user = {
            id: uuidv4(),
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash: hash,
            plan: 'free',
            credits: 100,
            role: 'user',
            createdAt: new Date().toISOString()
        };

        users.push(user);
        saveUsers(users);

        const token = signToken(user);
        res.status(201).json({
            token,
            user: { id: user.id, name: user.name, email: user.email, plan: user.plan, credits: user.credits, role: user.role }
        });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const users = loadUsers();
        const user = users.find(u => u.email === email.toLowerCase().trim());

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = signToken(user);
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, plan: user.plan, credits: user.credits, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────
router.get('/me', require('../middleware/auth').verifyToken, (req, res) => {
    res.json({ user: req.user });
});

// ── OAuth 2.0 Integrations (Google & GitHub) ─────────────────────────────
const axios = require('axios');

// --- Google OAuth ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'placeholder_google_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'placeholder_google_secret';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

router.get('/google', (req, res) => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_REDIRECT_URI}&response_type=code&scope=profile email`;
    res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.redirect('/login.html?error=NoCodeProvided');

        // Exchange code for token
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code,
            redirect_uri: GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code'
        });

        // Get user info
        const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        handleOAuthLogin(userRes.data.email, userRes.data.name, res);
    } catch (err) {
        console.error('Google OAuth Error:', err.message);
        res.redirect('/login.html?error=GoogleAuthFailed');
    }
});

// --- GitHub OAuth ---
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'placeholder_github_id';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'placeholder_github_secret';

router.get('/github', (req, res) => {
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user:email`;
    res.redirect(url);
});

router.get('/github/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.redirect('/login.html?error=NoCodeProvided');

        // Exchange code for token
        const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code
        }, { headers: { Accept: 'application/json' } });

        // Get user info
        const userRes = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        // GitHub emails can be private, so fetch emails separately
        let email = userRes.data.email;
        if (!email) {
            const emailRes = await axios.get('https://api.github.com/user/emails', {
                headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
            });
            const primary = emailRes.data.find(e => e.primary);
            if (primary) email = primary.email;
        }

        handleOAuthLogin(email, userRes.data.login || userRes.data.name, res);
    } catch (err) {
        console.error('GitHub OAuth Error:', err.message);
        res.redirect('/login.html?error=GithubAuthFailed');
    }
});

// Helper: Common login/register logic for OAuth providers
async function handleOAuthLogin(email, name, res) {
    if (!email) return res.redirect('/login.html?error=EmailRequiredFromOAuth');

    let users = loadUsers();
    let user = users.find(u => u.email === email.toLowerCase());

    if (!user) {
        // Auto-register OAuth user
        user = {
            id: uuidv4(),
            name: name || 'OauthUser',
            email: email.toLowerCase(),
            passwordHash: await bcrypt.hash(uuidv4(), 10), // Random password since they login via OAuth
            plan: 'free',
            credits: 100,
            role: 'user',
            createdAt: new Date().toISOString()
        };
        users.push(user);
        saveUsers(users);
    }

    const token = signToken(user);
    // Redirect to login.html with token injected via URL hash
    // The login.html script handles storing the token and fetching user info
    res.redirect(`/login.html#token=${token}`);
}

module.exports = router;
