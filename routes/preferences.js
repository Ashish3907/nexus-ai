const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth');

const PREF_PATH = path.join(__dirname, '../data/preferences.json');

router.get('/', verifyToken, (req, res) => {
    try {
        if (!fs.existsSync(PREF_PATH)) return res.json({ preferences: {} });
        const data = JSON.parse(fs.readFileSync(PREF_PATH, 'utf8'));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/', verifyToken, (req, res) => {
    try {
        const { preferences } = req.body;
        fs.writeFileSync(PREF_PATH, JSON.stringify({ preferences }, null, 4));
        res.json({ message: 'Preferences updated successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
