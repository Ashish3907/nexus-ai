const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const axios = require('axios');
const cheerio = require('cheerio');

// GET /api/web/search?q=query
// Note: Real implementation would use Google/Serper/Brave API.
// We'll simulate a search result or use a basic scraper if a URL is provided.
router.get('/search', verifyToken, async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        // Simulation of search intelligence
        // In a real prod environment, you'd call a Search API here.
        res.json({
            results: [
                { title: `Search Result for ${query}`, url: "https://nexusai.io/web", snippet: `Live intelligence analysis for ${query} is being processed...` }
            ]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/web/crawl
router.post('/crawl', verifyToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (NexusAI Autonomous Crawler)' }
        });
        const $ = cheerio.load(response.data);

        // Extract main text content
        const title = $('title').text();
        const bodyContent = $('p').map((i, el) => $(el).text()).get().join(' ').slice(0, 5000);

        res.json({
            url,
            title,
            content: bodyContent
        });
    } catch (error) {
        res.status(500).json({ error: `Crawl failed: ${error.message}` });
    }
});

module.exports = router;
