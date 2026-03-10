const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middleware/auth');

const AGENTS_FILE = path.join(__dirname, '../data/agents.json');

const getAgents = () => {
    if (!fs.existsSync(AGENTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
};

const saveAgents = (agents) => {
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2));
};

router.get('/', verifyToken, (req, res) => {
    const agents = getAgents();
    // In a real app, we'd filter by userId too
    res.json(agents);
});

router.post('/', verifyToken, (req, res) => {
    const { name, description, systemPrompt, icon } = req.body;
    if (!name || !systemPrompt) return res.status(400).json({ error: 'Name and System Prompt are required' });

    const agents = getAgents();
    const newAgent = {
        id: uuidv4(),
        userId: req.user.id,
        name,
        description,
        systemPrompt,
        icon: icon || 'user-robot',
        type: 'custom',
        createdAt: new Date().toISOString()
    };

    agents.push(newAgent);
    saveAgents(agents);
    res.status(201).json(newAgent);
});

module.exports = router;
