# NexusAI — AI Content Studio 🤖

A full-stack AI SaaS platform powered by GPT-4o. Includes content writing, AI chat, image prompt generation, code helper, and SEO optimization.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```bash
# Copy the example file
copy .env.example .env
```
Then open `.env` and fill in your API keys:
- `OPENAI_API_KEY` — from https://platform.openai.com
- `STRIPE_SECRET_KEY` — from https://dashboard.stripe.com (optional)
- `JWT_SECRET` — any random long string

### 3. Run Locally
```bash
npm start
```
Open http://localhost:3000 in your browser.

---

## 🌐 Deploy to Vercel (Free)

### Step 1 — Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2 — Login & Deploy
```bash
vercel
```
Follow the prompts. Choose "No" for existing project setup.

### Step 3 — Set Environment Variables
In Vercel dashboard → Project → Settings → Environment Variables, add:
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `JWT_SECRET`
- `FRONTEND_URL` (your Vercel URL, e.g., https://nexusai.vercel.app)

### Step 4 — Redeploy
```bash
vercel --prod
```

---

## 📁 Project Structure

```
ai-platform/
├── server.js           # Express server entry point
├── routes/
│   ├── ai.js           # GPT-4o AI routes
│   ├── auth.js         # Login / Register (JWT)
│   └── payments.js     # Stripe checkout
├── middleware/
│   └── auth.js         # JWT verification
├── public/             # Static frontend
│   ├── index.html      # Main dashboard
│   ├── login.html      # Auth page
│   ├── styles.css      # Premium UI
│   └── app.js          # Frontend logic
├── data/               # Auto-created user database
│   └── users.json
├── .env                # Your secrets (never commit!)
├── .env.example        # Safe to commit template
└── vercel.json         # Deployment config
```

---

## 💳 Setting Up Stripe Payments

1. Create account at https://stripe.com
2. Go to Products → Create 3 products: Starter ($9), Pro ($29), Business ($99)
3. Set billing as "Recurring" (monthly)
4. Copy each product's Price ID into `.env`
5. Copy your Secret Key from API Keys section

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login → JWT |
| GET | /api/auth/me | Get current user |
| POST | /api/ai/chat | GPT-4o chat |
| POST | /api/ai/content | Content generation |
| POST | /api/ai/image-prompt | Image prompts |
| POST | /api/ai/code | Code generation |
| POST | /api/ai/seo | SEO analysis |
| POST | /api/payments/checkout | Stripe session |

---

## 🌱 Next Steps to Scale

- [ ] Replace `data/users.json` with a real database (Supabase / MongoDB)
- [ ] Add usage limits per plan
- [ ] Add Stripe webhook to update user plan on payment
- [ ] Add email verification (Resend.com — free tier)
- [ ] Add analytics (PostHog — free tier)
