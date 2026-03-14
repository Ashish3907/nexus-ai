const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const axios = require('axios');
const cheerio = require('cheerio');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Helper: Search via DuckDuckGo HTML scraper ────────────────────────────── 
async function searchWeb(query) {
    const results = [];

    try {
        // DuckDuckGo HTML search — most reliable free option
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Referer': 'https://duckduckgo.com/'
            }
        });

        const $ = cheerio.load(response.data);

        $('.result').each((i, el) => {
            if (i >= 6) return false;

            const titleEl = $(el).find('.result__title');
            const title = titleEl.text().trim();
            const href = titleEl.find('a').attr('href') || '';
            const snippet = $(el).find('.result__snippet').text().trim();
            const urlText = $(el).find('.result__url').text().trim();

            if (!title || !snippet) return;

            // Parse the real URL from the DDG redirect
            let realUrl = href;
            if (href.includes('uddg=')) {
                try {
                    const urlParam = new URL('https://duckduckgo.com' + href).searchParams.get('uddg');
                    if (urlParam) realUrl = decodeURIComponent(urlParam);
                } catch (_) { /* keep original */ }
            } else if (!href.startsWith('http')) {
                realUrl = urlText.startsWith('http') ? urlText : `https://${urlText}`;
            }

            let domain = '';
            try {
                domain = new URL(realUrl).hostname.replace('www.', '');
            } catch (_) {
                domain = urlText.split('/')[0].replace('www.', '');
            }

            results.push({
                index: results.length + 1,
                title: title.slice(0, 120),
                url: realUrl,
                snippet: snippet.slice(0, 350),
                source: domain
            });
        });

    } catch (err) {
        console.error('DuckDuckGo HTML search error:', err.message);
    }

    // Fallback: Try DuckDuckGo Instant Answer API
    if (results.length === 0) {
        try {
            const ddgRes = await axios.get('https://api.duckduckgo.com/', {
                params: { q: query, format: 'json', no_redirect: 1, skip_disambig: 1 },
                timeout: 5000
            });
            const data = ddgRes.data;

            if (data.AbstractURL && data.AbstractText) {
                results.push({
                    index: 1,
                    title: data.Heading || query,
                    url: data.AbstractURL,
                    snippet: data.AbstractText.slice(0, 350),
                    source: data.AbstractSource
                });
            }

            (data.RelatedTopics || []).slice(0, 4).forEach((t, i) => {
                if (t.FirstURL && t.Text) {
                    let domain = '';
                    try { domain = new URL(t.FirstURL).hostname.replace('www.', ''); } catch (_) { domain = 'web'; }
                    results.push({
                        index: results.length + 1,
                        title: t.Text.slice(0, 100),
                        url: t.FirstURL,
                        snippet: t.Text.slice(0, 350),
                        source: domain
                    });
                }
            });
        } catch (err2) {
            console.error('DDG Instant fallback error:', err2.message);
        }
    }

    return results;
}

// ── Helper: Crawl page content ──────────────────────────────────────────────
async function crawlPage(url) {
    try {
        const response = await axios.get(url, {
            timeout: 7000,
            maxRedirects: 3,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, header, aside, [class*="nav"], [class*="menu"], [id*="header"], [id*="footer"]').remove();

        const title = $('h1').first().text().trim() || $('title').text().trim();
        const paragraphs = $('article p, main p, .content p, p')
            .map((i, el) => $(el).text().trim())
            .get()
            .filter(p => p.length > 50)
            .slice(0, 8)
            .join('\n');

        return { title, content: paragraphs.slice(0, 1800) };
    } catch (_) {
        return null;
    }
}

// ── POST /api/web/search — NexusSearch RAG Pipeline ────────────────────────
router.post('/search', verifyToken, async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        // Step 1: Search
        const results = await searchWeb(query);

        if (results.length === 0) {
            // Even with no results, answer from Groq's knowledge
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'You are NexusSearch, an AI assistant. Answer the question clearly and thoroughly using your knowledge. Use markdown formatting.'
                    },
                    { role: 'user', content: query }
                ],
                max_tokens: 800,
                temperature: 0.4
            });

            return res.json({
                answer: completion.choices[0]?.message?.content || 'No answer generated.',
                sources: []
            });
        }

        // Step 2: Crawl top 3 for richer context
        const crawlResults = await Promise.allSettled(
            results.slice(0, 3).map(r => crawlPage(r.url))
        );

        // Step 3: Build context
        let context = '';
        results.slice(0, 5).forEach((r, i) => {
            const crawled = crawlResults[i]?.status === 'fulfilled' ? crawlResults[i].value : null;
            context += `\n[Source ${i + 1}] ${r.title}\nURL: ${r.url}\n`;
            if (crawled?.content) {
                context += `Content: ${crawled.content}\n`;
            } else {
                context += `Summary: ${r.snippet}\n`;
            }
        });

        // Step 4: Synthesize with Groq
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: `You are NexusSearch — an AI answering questions using live web sources.
                    Rules:
                    - Cite sources inline with [1], [2], etc.
                    - Use **bold** for key terms
                    - Use ## headings where helpful
                    - Be comprehensive, at least 3-4 paragraphs
                    - Start directly with the answer, no preamble
                    - End with a brief conclusion`
                },
                {
                    role: 'user',
                    content: `Question: ${query}\n\nSources:\n${context}`
                }
            ],
            max_tokens: 1024,
            temperature: 0.3
        });

        const answer = completion.choices[0]?.message?.content || 'No answer generated.';

        res.json({ answer, sources: results.slice(0, 6) });

    } catch (err) {
        console.error('NexusSearch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Legacy GET endpoint
router.get('/search', verifyToken, async (req, res) => {
    res.json({ message: 'Use POST /api/web/search for NexusSearch.' });
});

// POST /api/web/crawl
router.post('/crawl', verifyToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    const result = await crawlPage(url);
    if (!result) return res.status(500).json({ error: 'Failed to crawl URL' });
    res.json({ url, ...result });
});

module.exports = router;
