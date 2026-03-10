const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

// Stripe setup — gracefully handle missing key
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const fs = require('fs');
const path = require('path');

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
            fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
        }
    } catch (err) {
        console.error('Failed to update user plan:', err);
    }
}

const PLANS = {
    starter: {
        name: 'Starter',
        price: '$9/month',
        priceId: process.env.STRIPE_PRICE_STARTER,
        features: ['500 credits/day', 'All AI tools', 'Email support']
    },
    pro: {
        name: 'Pro',
        price: '$29/month',
        priceId: process.env.STRIPE_PRICE_PRO,
        features: ['Unlimited credits', 'GPT-4o access', 'API access', 'Priority support']
    },
    business: {
        name: 'Business',
        price: '$99/month',
        priceId: process.env.STRIPE_PRICE_BUSINESS,
        features: ['5 team seats', 'Custom AI training', 'White-label', 'Dedicated support']
    }
};

// ── POST /api/payments/checkout ──────────────────────────────────────────
router.post('/checkout', verifyToken, async (req, res) => {
    try {
        const { plan } = req.body;
        const selectedPlan = PLANS[plan];

        if (!selectedPlan) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }

        // If Stripe not configured, return a demo message
        if (!stripe) {
            return res.json({
                demo: true,
                message: `Demo mode: Would create a Stripe checkout for ${selectedPlan.name} (${selectedPlan.price}). Add your STRIPE_SECRET_KEY to .env to enable real payments.`,
                plan: selectedPlan
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{
                price: selectedPlan.priceId,
                quantity: 1
            }],
            customer_email: req.user.email,
            metadata: { userId: req.user.id, plan },
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?payment=success&plan=${plan}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?payment=cancelled`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('Payment error:', err.message);
        res.status(500).json({ error: 'Payment setup failed.' });
    }
});

// ── GET /api/payments/plans ──────────────────────────────────────────────
router.get('/plans', (req, res) => {
    res.json({ plans: PLANS, stripeEnabled: !!stripe });
});

// ── POST /api/payments/webhook (Stripe Webhook) ──────────────────────────
router.post('/webhook', (req, res) => {
    const event = req.body;

    // Handle the checkout.session.completed event
    if (event && event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (userId && plan) {
            updateUserPlan(userId, plan);
            console.log(`✅ User ${userId} upgraded to ${plan} plan via Stripe payload.`);
        }
    }

    res.json({ received: true });
});

module.exports = router;
