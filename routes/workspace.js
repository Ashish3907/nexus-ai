const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middleware/auth');

const WORKSPACES_FILE = path.join(__dirname, '../data/workspaces.json');
const LIBRARY_FILE = path.join(__dirname, '../data/library.json');

// Helper to read/write JSON
const readData = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ── Workspace Routes ────────────────────────────────────────────────────────

// Get all workspaces for a user
router.get('/', verifyToken, (req, res) => {
    const workspaces = readData(WORKSPACES_FILE);
    const userWorkspaces = workspaces.filter(w => w.userId === req.user.id);
    res.json(userWorkspaces);
});

// Create new workspace
router.post('/', verifyToken, (req, res) => {
    const { name, icon } = req.body;
    const workspaces = readData(WORKSPACES_FILE);

    const newWorkspace = {
        id: uuidv4(),
        userId: req.user.id,
        name: name || 'Untitled Project',
        icon: icon || 'folder',
        createdAt: new Date().toISOString()
    };

    workspaces.push(newWorkspace);
    writeData(WORKSPACES_FILE, workspaces);
    res.status(201).json(newWorkspace);
});

// ── Library / Saved Items Routes ────────────────────────────────────────────

// Get saved items for a user (optionally filtered by workspace)
router.get('/library', verifyToken, (req, res) => {
    const { workspaceId } = req.query;
    const items = readData(LIBRARY_FILE);
    let userItems = items.filter(i => i.userId === req.user.id);

    if (workspaceId) {
        userItems = userItems.filter(i => i.workspaceId === workspaceId);
    }

    res.json(userItems);
});

// Save item to library
router.post('/library', verifyToken, (req, res) => {
    const { type, title, content, workspaceId, metadata } = req.body;
    const items = readData(LIBRARY_FILE);

    const newItem = {
        id: uuidv4(),
        userId: req.user.id,
        workspaceId: workspaceId || null,
        type, // 'chat', 'content', 'code', 'image'
        title: title || 'Untitled AI Generation',
        content,
        metadata: metadata || {},
        createdAt: new Date().toISOString()
    };

    items.push(newItem);
    writeData(LIBRARY_FILE, items);
    res.status(201).json(newItem);
});

// Delete item
router.delete('/library/:id', verifyToken, (req, res) => {
    const items = readData(LIBRARY_FILE);
    const filtered = items.filter(i => i.id !== req.params.id || i.userId !== req.user.id);
    writeData(LIBRARY_FILE, filtered);
    res.json({ message: 'Item deleted' });
});

module.exports = router;
