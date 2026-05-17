import express from 'express';
import fs from 'fs/promises';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  uploadMiddleware,
  handleUploadError
} from '../middleware/upload.middleware.js';
import {
  extractTextFromFile,
  saveDocument,
  getDocument,
  getDocumentsByIds,
  getUserDocuments,
  buildDocumentQAPrompt,
  buildMultiDocumentQAPrompt,
  deleteDocument
} from '../services/document.service.js';
import { streamAI } from '../services/ai.stream.js';
import { Document } from '../models/document.model.js';
import { streamRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

function requireMultipartUpload(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return res.status(400).json({
      success: false,
      error: 'Content-Type must be multipart/form-data for file uploads.',
      code: 'INVALID_UPLOAD_CONTENT_TYPE'
    });
  }
  next();
}

async function cleanupUploadedFile(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[DOC] Failed to remove uploaded file:', error.message);
    }
  }
}

// All document routes require auth
router.use(authenticate);

// ── POST /api/documents/upload ────────────────────────────────
router.post(
  '/upload',
  requireMultipartUpload,
  uploadMiddleware.single('file'),   // 'file' = form field name
  handleUploadError,                  // Handle multer-specific errors
  async (req, res) => {
    // Check file was actually uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Send file in "file" field.'
      });
    }

    const { file } = req;

    try {
      // 1. Extract text from uploaded file
      console.log(`[DOC] Extracting text from: ${file.originalname}`);
      const extractionResult = await extractTextFromFile(file.path, file.mimetype);

      // Check if extraction got any text
      if (!extractionResult.text || extractionResult.text.length < 10) {
        await cleanupUploadedFile(file.path);
        return res.status(422).json({
          success: false,
          error: 'Could not extract text from this file. It may be scanned/image-based.',
          code: 'EXTRACTION_FAILED'
        });
      }

      // 2. Save document record to MongoDB
      const document = await saveDocument(req.user.id, file, extractionResult);

      console.log(`[DOC] Saved: ${document._id} — ${extractionResult.wordCount} words`);

      res.status(201).json({
        success: true,
        message: 'Document uploaded and processed successfully.',
        data: {
          id: document._id,
          originalName: document.originalName,
          mimeType: document.mimeType,
          fileSizeBytes: document.fileSizeBytes,
          pageCount: document.pageCount,
          wordCount: document.wordCount,
          estimatedTokenCount: document.estimatedTokenCount,
          createdAt: document.createdAt
        }
      });

    } catch (error) {
      await cleanupUploadedFile(file.path);
      console.error('[DOC] Upload processing failed:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to process document.',
        details: error.message
      });
    }
  }
);

// ── GET /api/documents ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const documents = await getUserDocuments(req.user.id);
    res.json({ success: true, data: documents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/documents/:id ────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const document = await getDocument(req.params.id, req.user.id);
    res.json({
      success: true,
      data: {
        id: document._id,
        originalName: document.originalName,
        mimeType: document.mimeType,
        pageCount: document.pageCount,
        wordCount: document.wordCount,
        estimatedTokenCount: document.estimatedTokenCount,
        queryCount: document.queryCount,
        createdAt: document.createdAt
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

// ── POST /api/documents/:id/chat ──────────────────────────────
// Stream AI answers about a specific document
router.post(
  '/multi-chat',
  streamRateLimiter,
  async (req, res) => {
    const { documentIds, question } = req.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'documentIds must be a non-empty array'
      });
    }

    if (documentIds.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'You can ask about up to 10 documents at a time'
      });
    }

    if (!question?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'question is required'
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'question must be under 1000 characters'
      });
    }

    let documents;
    try {
      documents = await getDocumentsByIds(documentIds, req.user.id);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }

    const notReadyDocument = documents.find(
      (document) => document.extractionStatus !== 'done' || !document.extractedText
    );

    if (notReadyDocument) {
      return res.status(422).json({
        success: false,
        error: `Document "${notReadyDocument.originalName}" is not ready for questions.`,
        code: 'DOCUMENT_NOT_READY'
      });
    }

    const { system: systemPrompt, wasTruncated } = buildMultiDocumentQAPrompt(documents);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    if (wasTruncated) {
      res.write(`data: ${JSON.stringify({
        type: 'warning',
        message: 'Combined document content was very large and has been partially processed.'
      })}\n\n`);
    }

    const controller = new AbortController();
    req.on('close', () => { controller.abort(); res.end(); });

    const startTime = Date.now();
    let fullAnswer = '';

    try {
      await streamAI(
        systemPrompt,
        [],
        question.trim(),

        (chunk) => {
          fullAnswer += chunk;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        },

        async ({ inputTokens, outputTokens }) => {
          const latencyMs = Date.now() - startTime;

          try {
            await Document.updateMany(
              { _id: { $in: documents.map((document) => document._id) } },
              { $inc: { queryCount: 1 } }
            );
          } catch (dbErr) {
            console.error('[DOC MULTI CHAT] Failed to update query counts:', dbErr.message);
          }

          res.write(`data: ${JSON.stringify({
            type: 'done',
            tokens: { input: inputTokens, output: outputTokens },
            latencyMs,
            documents: documents.map((document) => ({
              id: document._id,
              name: document.originalName
            }))
          })}\n\n`);
          res.end();
        },

        (error) => {
          console.error('[DOC MULTI CHAT ERROR]', error.message);
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({
              type: 'error',
              message: error.message
            })}\n\n`);
            res.end();
          }
        },

        controller.signal
      );
    } catch (error) {
      console.error('[DOC MULTI CHAT ROUTE ERROR]', error.message);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong' })}\n\n`);
        res.end();
      }
    }
  }
);

router.post(
  '/:id/chat',
  streamRateLimiter,
  async (req, res) => {
    const { question } = req.body;

    // Validate question
    if (!question?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'question is required'
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'question must be under 1000 characters'
      });
    }

    // Load document
    let document;
    try {
      document = await getDocument(req.params.id, req.user.id);
    } catch (error) {
      return res.status(error.statusCode || 404).json({
        success: false,
        error: error.message
      });
    }

    // Check extraction was successful
    if (document.extractionStatus !== 'done' || !document.extractedText) {
      return res.status(422).json({
        success: false,
        error: 'Document text extraction failed. Cannot process questions.',
        code: 'DOCUMENT_NOT_READY'
      });
    }

    // Warn if document is very large
    // Gemini 2.5 Flash can handle it but latency increases
    if (document.estimatedTokenCount > 500_000) {
      console.warn(`[DOC] Large document: ${document.estimatedTokenCount} estimated tokens`);
    }

    // Build document-aware system prompt
    const { system: systemPrompt, wasTruncated } = buildDocumentQAPrompt(
      document.extractedText,
      document.originalName
    );

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Notify frontend if document was truncated
    if (wasTruncated) {
      res.write(`data: ${JSON.stringify({
        type: 'warning',
        message: 'Document was very large and has been partially processed.'
      })}\n\n`);
    }

    const controller = new AbortController();
    req.on('close', () => { controller.abort(); res.end(); });

    const startTime = Date.now();
    let fullAnswer = '';

    try {
      await streamAI(
        systemPrompt,
        [],                  // No conversation history — document context is in system prompt
        question.trim(),

        // onChunk
        (chunk) => {
          fullAnswer += chunk;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        },

        // onDone
        async ({ inputTokens, outputTokens }) => {
          const latencyMs = Date.now() - startTime;

          // Increment query count on document
          try {
            await Document.findByIdAndUpdate(document._id, {
              $inc: { queryCount: 1 }
            });
          } catch (dbErr) {
            console.error('[DOC] Failed to update query count:', dbErr.message);
          }

          res.write(`data: ${JSON.stringify({
            type: 'done',
            tokens: { input: inputTokens, output: outputTokens },
            latencyMs,
            document: {
              id: document._id,
              name: document.originalName
            }
          })}\n\n`);
          res.end();
        },

        // onError
        (error) => {
          console.error('[DOC CHAT ERROR]', error.message);
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({
              type: 'error',
              message: error.message
            })}\n\n`);
            res.end();
          }
        },

        controller.signal
      );
    } catch (error) {
      console.error('[DOC CHAT ROUTE ERROR]', error.message);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong' })}\n\n`);
        res.end();
      }
    }
  }
);

// ── POST /api/documents/:id/summarize ─────────────────────────
// Get a quick AI summary of the entire document
router.post('/:id/summarize', streamRateLimiter, async (req, res) => {
  let document;
  try {
    document = await getDocument(req.params.id, req.user.id);
  } catch (error) {
    return res.status(error.statusCode || 404).json({
      success: false,
      error: error.message
    });
  }

  if (!document.extractedText) {
    return res.status(422).json({
      success: false,
      error: 'Document not ready for processing.'
    });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const controller = new AbortController();
  req.on('close', () => { controller.abort(); res.end(); });

  const systemPrompt = `You are a document summarizer.
Provide a clear, structured summary of the given document.

Format your response exactly like this:

## Overview
[2-3 sentences describing what this document is about]

## Key Points
- [key point 1]
- [key point 2]
- [key point 3]
- [add more as needed]

## Important Details
[Any critical numbers, dates, names, or decisions mentioned]

## Conclusion
[1-2 sentences on the main takeaway]

Document:
─────────────────────────────────────
${document.extractedText.substring(0, 800_000)}
─────────────────────────────────────`;

  let summary = '';

  try {
    await streamAI(
      systemPrompt,
      [],
      'Please summarize this document.',

      (chunk) => {
        summary += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },

      async ({ inputTokens, outputTokens }) => {
        // Save summary to document record
        try {
          await Document.findByIdAndUpdate(document._id, {
            $inc: { queryCount: 1 }
          });
        } catch (e) { /* non-critical */ }

        res.write(`data: ${JSON.stringify({
          type: 'done',
          tokens: { input: inputTokens, output: outputTokens }
        })}\n\n`);
        res.end();
      },

      (error) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          res.end();
        }
      },

      controller.signal
    );
  } catch (error) {
    console.error('[DOC SUMMARY ROUTE ERROR]', error.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong' })}\n\n`);
      res.end();
    }
  }
});

// ── DELETE /api/documents/:id ─────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await deleteDocument(req.params.id, req.user.id);
    res.json({ success: true, message: 'Document deleted.' });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
