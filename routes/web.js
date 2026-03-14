const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const axios = require('axios');
const cheerio = require('cheerio');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Helper: Search using DuckDuckGo (free, no key needed) ──────────────────
async function searchDuckDuckGo(query) {
    try {
        const response = await axios.get('https://api.duckduckgo.com/', {
            params: {
                q: query,
                format: 'json',
                no_redirect: 1,
                no_html: 1,
                skip_disambig: 1
            },
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (NexusAI Search Bot)' }
        });

        const data = response.data;
        const results = [];

        // Abstract result (main answer)
        if (data.AbstractURL && data.AbstractText) {
            results.push({
                title: data.Heading || query,
                url: data.AbstractURL,
                snippet: data.AbstractText.slice(0, 300),
                source: data.AbstractSource
            });
        }

        // Related topics
        if (data.RelatedTopics) {
            for (const topic of data.RelatedTopics.slice(0, 6)) {
                if (topic.FirstURL && topic.Text) {
                    results.push({
                        title: topic.Text.slice(0, 80),
                        url: topic.FirstURL,
                        snippet: topic.Text.slice(0, 300),
                        source: new URL(topic.FirstURL).hostname.replace('www.', '')
                    });
                }
            }
        }

        return results;
    } catch (err) {
        console.error('DuckDuckGo search error:', err.message);
        return [];
    }
}

// ── Helper: Search using Google via SerpAPI fallback scraper ──────────────── 
async function searchGoogleFallback(query) {
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const results = [];

        $('.result').each((i, el) => {
            if (i >= 5) return false;
            const title = $(el).find('.result__title a').text().trim();
            const url = $(el).find('.result__url').text().trim();
            const snippet = $(el).find('.result__snippet').text().trim();

            if (title && snippet) {
                const fullUrl = url.startsWith('http') ? url : `https://${url}`;
                results.push({
                    title: title.slice(0, 100),
                    url: fullUrl,
                    snippet: snippet.slice(0, 300),
                    source: url.split('/')[0].replace('www.', '')
                });
            }
        });

        return results;
    } catch (err) {
        console.error('Fallback search error:', err.message);
        return [];
    }
}

// ── Helper: Crawl page content ────────────────────────────────────────────── 
async function crawlPage(url) {
    try {
        const response = await axios.get(url, {
            timeout: 6000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);

        // Remove script/style/nav garbage
        $('script, style, nav, footer, header, ads, [class*="nav"], [class*="menu"], [id*="nav"]').remove();

        const title = $('title').text().trim();
        const h1 = $('h1').first().text().trim();
        const paragraphs = $('p').map((i, el) => $(el).text().trim()).get()
            .filter(p => p.length > 40)
            .slice(0, 8)
            .join('\n');

        return { title: h1 || title, content: paragraphs.slice(0, 1500) };
    } catch (err) {
        return null;
    }
}

// ── POST /api/web/search — Full NexusSearch RAG Pipeline ─────────────────── 
router.post('/search', verifyToken, async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        // Step 1: Search
        let results = await searchDuckDuckGo(query);
        if (results.length < 2) {
            results = await searchGoogleFallback(query);
        }

        if (results.length === 0) {
            return res.json({
                answer: "I couldn't find any live results for that query. Please try a different search term.",
                sources: []
            });
        }

        // Step 2: Crawl top 3 results for richer content
        const crawlTargets = results.slice(0, 3);
        const crawledData = await Promise.allSettled(
            crawlTargets.map(r => crawlPage(r.url))
        );

        // Step 3: Build context for Groq
        let context = '';
        results.slice(0, 5).forEach((r, i) => {
            const crawled = crawledData[i]?.status === 'fulfilled' ? crawledData[i].value : null;
            context += `\n\n[Source ${i + 1}: ${r.title}]\nURL: ${r.url}\n`;
            if (crawled && crawled.content) {
                context += `Content: ${crawled.content}\n`;
            } else {
                context += `Snippet: ${r.snippet}\n`;
            }
        });

        // Step 4: Synthesize with Groq
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: `You are NexusSearch, an AI search assistant like Perplexity. 
                    You answer questions using real web sources provided to you.
                    Always cite your sources inline using [1], [2], etc. at the end of sentences.
                    Be comprehensive but concise. Use markdown formatting.
                    Start directly with the answer — no preamble like "Based on the sources..."`
                },
                {
                    role: 'user',
                    content: `Question: ${query}\n\nWeb Sources:\n${context}\n\nProvide a well-cited answer using these sources.`
                }
            ],
            max_tokens: 1024,
            temperature: 0.3
        });

        const answer = completion.choices[0]?.message?.content || 'No answer generated.';

        res.json({
            answer,
            sources: results.slice(0, 6).map((r, i) => ({
                index: i + 1,
                title: r.title,
                url: r.url,
                snippet: r.snippet,
                source: r.source || (r.url ? new URL(r.url).hostname.replace('www.', '') : 'web')
            }))
        });

    } catch (err) {
        console.error('NexusSearch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Legacy GET search endpoint
router.get('/search', verifyToken, async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });
    res.json({ results: [], message: 'Use POST /api/web/search for full NexusSearch.' });
});

// POST /api/web/crawl — standalone URL crawl
router.post('/crawl', verifyToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    try {
        const result = await crawlPage(url);
        if (!result) return res.status(500).json({ error: 'Failed to crawl URL' });
        res.json({ url, ...result });
    } catch (error) {
        res.status(500).json({ error: `Crawl failed: ${error.message}` });
    }
});

module.exports = router;
