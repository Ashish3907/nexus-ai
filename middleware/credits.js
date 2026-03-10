const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'users.json');

const COSTS = {
    chat: 1,
    image: 5,
    audio: 5,
    vision: 5,
    document: 10,
    web: 2,
    seo: 1
};

/**
 * Deduct credits from user. Returns true if successful, false if insufficient.
 */
async function deductCredits(userId, actionType) {
    try {
        if (!fs.existsSync(DB_PATH)) return false;

        const users = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        const userIdx = users.findIndex(u => u.id === userId);

        if (userIdx === -1) return false;

        const user = users[userIdx];
        const cost = COSTS[actionType] || 1;

        // Admins have infinite credits
        if (user.role === 'admin') return true;

        if (user.credits < cost) {
            return false;
        }

        user.credits -= cost;
        fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        console.error('[Credits] Error deducting credits:', error);
        return false;
    }
}

module.exports = { deductCredits, COSTS };
