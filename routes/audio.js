const express = require('express');
const router = express.Router();
const { Groq } = require('groq-sdk');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth');
const { deductCredits } = require('../middleware/credits');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/audio/transcribe
router.post('/transcribe', verifyToken, async (req, res) => {
    // Deduct credits first
    const hasCredits = await deductCredits(req.user.id, 'audio');
    if (!hasCredits) return res.status(402).json({ error: 'Insufficient credits.' });

    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('[Audio] Upload error:', err);
            return res.status(500).json({ error: 'Failed to process audio upload' });
        }

        const audioFile = files.audio;
        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Get the real file object from formidable (v2 vs v3 handle this differently)
        const fileObj = Array.isArray(audioFile) ? audioFile[0] : audioFile;
        const originalPath = fileObj.filepath;
        const extension = path.extname(fileObj.originalFilename || '.mp3');
        const filePath = originalPath + extension;

        try {
            // Rename to preserve extension for Groq
            fs.renameSync(originalPath, filePath);
            console.log(`[Audio] Transcribing: ${fileObj.originalFilename} (Path: ${filePath})`);

            // Call Groq Whisper API
            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(filePath),
                model: 'whisper-large-v3',
                prompt: 'Transcribe this audio clearly, following any technical terminology.',
                response_format: 'json',
                language: 'en'
            });

            // Cleanup temp file
            fs.unlink(filePath, () => { });

            res.json({
                text: transcription.text,
                filename: fileObj.originalFilename
            });

        } catch (error) {
            console.error('[Audio] Groq Transcription error:', error);
            // Cleanup temp file
            if (filePath) fs.unlink(filePath, () => { });
            res.status(500).json({ error: 'Transcription failed: ' + error.message });
        }
    });
});

module.exports = router;
