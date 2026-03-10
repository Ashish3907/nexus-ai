# 🚀 Deploying NexusAI to the Internet

Since you want to share NexusAI with your friends, follow these steps to get it online 24/7!

## Step 1: Push to GitHub
To deploy to most cloud services, your code needs to be on GitHub.
1.  **Create a Repository**: Go to [GitHub](https://github.com/new) and create a new repository called `nexus-ai`.
2.  **Upload Files**: Since Git isn't installed on your local machine's terminal right now, you can simply **drag and drop** the folder contents into GitHub using their "Upload files" feature in the browser.
    > [!IMPORTANT]
    > Do **NOT** upload the `node_modules` folder (it's too large and not needed).

## Step 2: Choose a Hosting Provider
I recommend **Render** or **Railway** because they are free and very easy to use for Node.js apps.

### Option A: Render (Easiest)
1.  Sign up at [render.com](https://render.com/).
2.  Click **New +** > **Web Service**.
3.  Connect your GitHub repository.
4.  **Settings**:
    - **Runtime**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `node server.js`

### Option B: Railway (Fastest)
1.  Sign up at [railway.app](https://railway.app/).
2.  Click **New Project** > **Deploy from GitHub repo**.
3.  Select your `nexus-ai` repo.

## Step 3: Configure Environment Variables
Both providers have an **"Environment"** or **"Env Vars"** tab. You MUST add your keys there:
- `GROQ_API_KEY`: Your real Groq API key.
- `JWT_SECRET`: Any random string (e.g., `NexusAI_Super_Secret_2026`).

## Step 4: Share the Link!
Once the build is finished, your provider will give you a URL like `https://nexus-ai.onrender.com`. Send that to your friends!

---

> [!NOTE]
> **Data Persistence**: Since we are using local JSON files (`data/*.json`), your data might reset if the server restarts on the free tier. For a permanent friend-group setup, we can look into connecting a database later!
