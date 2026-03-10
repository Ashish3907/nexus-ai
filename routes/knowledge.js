const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth');

const readData = (file) => {
    const filePath = path.join(__dirname, '../data', file);
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) { return []; }
};

// GET /api/knowledge/search?q=query
router.get('/search', verifyToken, (req, res) => {
    const query = (req.query.q || '').toLowerCase();
    if (!query) return res.json({ context: "" });

    try {
        const library = readData('library.json');
        const chats = readData('chats.json');

        // Simple keyword-based semantic extraction
        let relevantFragments = [];

        // Scan Library (Docs, Images, Prompts)
        library.forEach(item => {
            if ((item.name && item.name.toLowerCase().includes(query)) ||
                (item.content && item.content.toLowerCase().includes(query))) {
                relevantFragments.push(`[Source: Library - ${item.name || item.type}] ${item.content || item.prompt}`);
            }
        });

        // Scan Chats
        chats.forEach((msg, index) => {
            if (msg.content && msg.content.toLowerCase().includes(query)) {
                // Get a bit of context around the message
                const snippet = chats.slice(Math.max(0, index - 1), index + 2)
                    .map(m => `${m.role}: ${m.content}`).join('\n');
                relevantFragments.push(`[Source: Past Chat] ${snippet}`);
            }
        });

        // Limit fragments to avoid token bloat
        const context = relevantFragments.slice(0, 5).join('\n\n---\n\n');
        res.json({ context });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
