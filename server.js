require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const aiRoutes = require('./routes/ai');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const workspaceRoutes = require('./routes/workspace');
const documentRoutes = require('./routes/document');
const agentRoutes = require('./routes/agent');
const audioRoutes = require('./routes/audio');
const adminRoutes = require('./routes/admin');
const knowledgeRoutes = require('./routes/knowledge');
const preferenceRoutes = require('./routes/preferences');
const webRoutes = require('./routes/web');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Permit all external resources (requested by user)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Loosen Content Security Policy to allow Pollinations and other assets
    res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval'; img-src * data:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';");
    next();
});

// ── Serve Static Frontend ──
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/docs', documentRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/web', webRoutes);

// ── Health Check ──
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0', service: 'NexusAI' });
});

// ── Catch-all: serve frontend (SPA routing) ──
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global Error Handler (Force JSON) ──
app.use((err, req, res, next) => {
    console.error('Server Exception:', err);
    if (res.headersSent) return next(err);

    const statusCode = err.status || 500;
    res.status(statusCode).json({
        error: err.message || 'Internal Server Error',
        code: err.code || 'SERVER_ERROR'
    });
});

// ── Start Server ──
app.listen(PORT, () => {
    console.log(`\n🚀 NexusAI server running on http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🤖 Groq AI: ${process.env.GROQ_API_KEY ? '✅ Connected' : '❌ Key missing'}`);
    console.log(`💳 Stripe:  ${process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_YOUR_STRIPE_SECRET_KEY_HERE' ? '✅ Connected' : '⚠️  Demo mode'}`);
});
