const express = require('express');
const router = express.Router();
const formidable = require('formidable');
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const { verifyToken } = require('../middleware/auth');
const { deductCredits } = require('../middleware/credits');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/analyze', verifyToken, async (req, res) => {
    // Deduct credits
    const hasCredits = await deductCredits(req.user.id, 'document');
    if (!hasCredits) return res.status(402).json({ error: 'Insufficient credits. Document AI requires 10 credits.' });

    const form = new formidable.IncomingForm({ maxFileSize: 50 * 1024 * 1024 });

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: 'File upload error: ' + err.message });

        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        let parser;
        let screenshotParser;
        let pageImages = [];

        try {
            let text = '';
            const filePath = file.filepath || file.path;
            const fileName = file.originalFilename || '';
            const lowerName = fileName.toLowerCase();

            if (lowerName.endsWith('.pdf')) {
                const dataBuffer = fs.readFileSync(filePath);

                // 1. Extract text
                parser = new PDFParse({ data: dataBuffer });
                const textResult = await parser.getText();
                text = textResult.text;

                // 2. Extract page screenshots (needs canvas; wrapped in try-catch)
                try {
                    screenshotParser = new PDFParse({ data: dataBuffer });
                    const info = await screenshotParser.getInfo();
                    const totalPages = info?.total || 0;

                    // Try getScreenshot — will fail gracefully without canvas
                    const screenshots = await screenshotParser.getScreenshot({ scale: 1.0, first: Math.min(totalPages, 10) });

                    if (screenshots && screenshots.pages) {
                        pageImages = screenshots.pages
                            .filter(p => p && p.imageDataUrl)
                            .map((p, i) => ({ page: i + 1, dataUrl: p.imageDataUrl }));
                    }
                } catch (screenshotErr) {
                    console.warn('[Document] Screenshot extraction skipped:', screenshotErr.message);
                    // Non-fatal — analysis still proceeds without page images
                } finally {
                    if (screenshotParser) await screenshotParser.destroy().catch(() => { });
                }

            } else if (lowerName.endsWith('.docx')) {
                const result = await mammoth.extractRawText({ path: filePath });
                text = result.value;
            } else if (lowerName.endsWith('.pptx')) {
                const result = await mammoth.extractRawText({ path: filePath }).catch(() => ({ value: '' }));
                text = result.value || '(PPTX text extraction limited)';
            } else {
                text = fs.readFileSync(filePath, 'utf8');
            }

            if (!text || text.trim().length < 10) {
                return res.status(422).json({ error: 'Could not extract text. The file may be scanned/image-only or password protected.' });
            }

            const userPrompt = Array.isArray(fields.prompt) ? fields.prompt[0] : (fields.prompt || 'Provide a detailed summary with key points and insights.');

            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are an elite document analyst and research expert. When analyzing documents, always produce a COMPREHENSIVE, DETAILED report with the following sections as applicable:

1. **Executive Summary** (3-4 paragraphs) — high level overview
2. **Key Findings** — numbered list with detailed explanations
3. **Deep Analysis** — thorough examination of the main content, arguments, data, concepts
4. **Important Data & Statistics** — all quantitative information found
5. **Themes & Patterns** — recurring ideas or structures
6. **Critical Insights** — your expert interpretation beyond what is stated
7. **Recommendations** — actionable next steps based on the content
8. **Risk Factors / Concerns** (if applicable)
9. **Conclusion** — synthesize the findings

Use **bold** for section headers and sub-points. Use bullet points generously. Be THOROUGH — the user wants deep research-level analysis, not a short summary. Aim for 800-1500 words in your response.`
                    },
                    {
                        role: 'user',
                        content: `DOCUMENT NAME: "${fileName}"\nTOTAL CHARACTERS: ${text.length.toLocaleString()}\n\nDOCUMENT CONTENT:\n${text.substring(0, 24000)}\n\n---\nUSER REQUEST: ${userPrompt}\n\nPlease give a thorough, comprehensive analysis. Be detailed and in-depth.`
                    }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: 8192,
            });

            const analysis = completion.choices[0].message.content;

            // Clean up temp file
            fs.unlink(filePath, () => { });

            res.json({
                analysis,
                pageImages,
                pageCount: pageImages.length,
                fileName,
                extractedChars: text.length
            });

        } catch (error) {
            console.error('Document Analysis Error:', error);
            res.status(500).json({ error: error.message });
        } finally {
            if (parser) await parser.destroy().catch(() => { });
        }
    });
});

module.exports = router;
