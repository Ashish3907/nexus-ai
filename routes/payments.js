const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Razorpay setup
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

function updateUserPlan(userId, plan) {
    const dbPath = path.join(__dirname, '..', 'data', 'users.json');
    try {
        let users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const idx = users.findIndex(u => u.id === userId);
        if (idx !== -1) {
            users[idx].plan = plan;
            // Upgrade credits based on plan
            if (plan === 'pro') users[idx].credits = 999999;
            if (plan === 'business') users[idx].credits = 9999999;
            if (plan === 'starter') users[idx].credits = (users[idx].credits || 0) + 1000;
            fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
        }
    } catch (err) {
        console.error('Failed to update user plan:', err);
    }
}

const PLANS = {
    starter: {
        name: 'Starter',
        price: '₹799',
        amountInPaise: 79900,
        features: ['1000 credits', 'All AI tools', 'Email support']
    },
    pro: {
        name: 'Pro',
        price: '₹2,499',
        amountInPaise: 249900,
        features: ['Unlimited credits', 'GPT-4o access', 'API access', 'Priority support']
    },
    business: {
        name: 'Business',
        price: '₹7,999',
        amountInPaise: 799900,
        features: ['5 team seats', 'Custom AI training', 'White-label', 'Dedicated support']
    }
};

// ── GET /api/payments/plans ──────────────────────────────────────────────
router.get('/plans', (req, res) => {
    res.json({
        plans: PLANS,
        razorpayKey: process.env.RAZORPAY_KEY_ID || '',
        upiId: 'sbashish3907@oksbi'
    });
});

// ── POST /api/payments/razorpay-order ────────────────────────────────────
router.post('/razorpay-order', verifyToken, async (req, res) => {
    try {
        const { plan } = req.body;
        const selectedPlan = PLANS[plan];
        if (!selectedPlan) return res.status(400).json({ error: 'Invalid plan.' });

        const options = {
            amount: selectedPlan.amountInPaise,
            currency: "INR",
            receipt: `rcpt_${req.user.id}_${Date.now()}`,
            notes: { userId: req.user.id, plan }
        };

        const order = await razorpay.orders.create(options);
        res.json({ order, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (err) {
        res.status(500).json({ error: 'Razorpay setup failed.' });
    }
});

// ── POST /api/payments/razorpay-verify ────────────────────────────────────
router.post('/razorpay-verify', verifyToken, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
            .update(body.toString()).digest('hex');

        if (expectedSignature === razorpay_signature) {
            updateUserPlan(req.user.id, plan);
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Verify failed.' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Auth error.' });
    }
});

// ── MANUAL PAYMENT ROUTES ────────────────────────────────────────────────

// POST /api/payments/manual-submit (User submits Trnx ID)
router.post('/manual-submit', verifyToken, (req, res) => {
    try {
        const { plan, transactionId } = req.body;
        if (!plan || !transactionId) return res.status(400).json({ error: 'Missing details.' });

        const dbPath = path.join(__dirname, '..', 'data', 'payments.json');
        let payments = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        const newPayment = {
            id: uuidv4(),
            userId: req.user.id,
            userEmail: req.user.email,
            plan,
            transactionId,
            status: 'pending',
            date: new Date().toISOString()
        };

        payments.push(newPayment);
        fs.writeFileSync(dbPath, JSON.stringify(payments, null, 2));

        res.json({ success: true, message: 'Request submitted for approval!' });
    } catch (err) {
        res.status(500).json({ error: 'Submission failed.' });
    }
});

// GET /api/payments/admin-pending (Admin views queue)
router.get('/admin-pending', verifyToken, requireAdmin, (req, res) => {
    try {
        const dbPath = path.join(__dirname, '..', 'data', 'payments.json');
        const payments = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(payments.filter(p => p.status === 'pending'));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch queue.' });
    }
});

// POST /api/payments/admin-action (Admin approves/rejects)
router.post('/admin-action', verifyToken, requireAdmin, (req, res) => {
    try {
        const { paymentId, action } = req.body; // action: 'approve' or 'reject'
        const dbPath = path.join(__dirname, '..', 'data', 'payments.json');
        let payments = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        const idx = payments.findIndex(p => p.id === paymentId);
        if (idx === -1) return res.status(404).json({ error: 'Payment not found.' });

        if (action === 'approve') {
            payments[idx].status = 'approved';
            updateUserPlan(payments[idx].userId, payments[idx].plan);
        } else {
            payments[idx].status = 'rejected';
        }

        fs.writeFileSync(dbPath, JSON.stringify(payments, null, 2));
        res.json({ success: true, message: `Payment ${action}d.` });
    } catch (err) {
        res.status(500).json({ error: 'Action failed.' });
    }
});

module.exports = router;
