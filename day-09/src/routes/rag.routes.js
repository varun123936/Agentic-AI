import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { streamAI } from '../services/ai.stream.js';
import {
  indexDocument,
  retrieveRelevantChunks,
  buildRagContext,
  removeDocumentFromIndex,
  chunkText
} from '../services/rag.service.js';
import { RagPrompts } from '../prompts/rag.prompts.js';
import { Document } from '../models/document.model.js';
import { Chunk } from '../models/chunk.model.js';
import { getCollectionStats } from '../services/vectorstore.service.js';

const router = express.Router();
router.use(authenticate);

// ── POST /api/rag/index/:documentId ───────────────────────────
// Index a previously uploaded document into vector store
router.post('/index/:documentId', async (req, res) => {
  try {
    // Load document — verify ownership
    const document = await Document.findOne({
      _id: req.params.documentId,
      userId: req.user.id,
      isActive: true
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    if (!document.extractedText) {
      return res.status(422).json({
        success: false,
        error: 'Document has no extracted text. Upload a text-based PDF.'
      });
    }

    // Check if already indexed
    const existingChunks = await Chunk.countDocuments({
      documentId: document._id
    });

    if (existingChunks > 0) {
      return res.status(409).json({
        success: false,
        error: `Document already indexed with ${existingChunks} chunks.`,
        code: 'ALREADY_INDEXED'
      });
    }

    // Index the document
    console.log(`[RAG] Starting indexing for: ${document.originalName}`);
    const result = await indexDocument(document, req.user.id);

    // Update document record
    await Document.findByIdAndUpdate(document._id, {
      isIndexed: true,
      indexedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Document indexed successfully.',
      data: {
        documentId: document._id,
        documentName: document.originalName,
        ...result
      }
    });

  } catch (error) {
    console.error('[RAG] Indexing error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INDEXING_FAILED'
    });
  }
});

// ── POST /api/rag/search ───────────────────────────────────────
// Semantic search — returns relevant chunks without AI generation
router.post('/search', async (req, res) => {
  const { query, documentId, topK = 5 } = req.body;

  if (!query?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'query is required'
    });
  }

  try {
    const chunks = await retrieveRelevantChunks(query, {
      userId: req.user.id,
      documentId,
      topK: Math.min(topK, 10)    // Cap at 10
    });

    res.json({
      success: true,
      data: {
        query,
        resultsFound: chunks.length,
        chunks: chunks.map(c => ({
          text: c.text.substring(0, 300) + (c.text.length > 300 ? '...' : ''),
          similarityScore: c.similarityScore,
          documentName: c.metadata.documentName,
          documentId: c.metadata.documentId
        }))
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST /api/rag/chat ─────────────────────────────────────────
// Full RAG pipeline — search + AI answer (streaming)
router.post('/chat', aiRateLimiter, async (req, res) => {
  const { question, documentId } = req.body;

  if (!question?.trim() || question.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'question is required and must be under 1000 characters'
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

  try {
    // Step 1: Retrieve relevant chunks
    res.write(`data: ${JSON.stringify({
      type: 'status',
      message: 'Searching knowledge base...'
    })}\n\n`);

    const relevantChunks = await retrieveRelevantChunks(question, {
      userId: req.user.id,
      documentId,
      topK: parseInt(process.env.RAG_TOP_K || '5')
    });

    // Step 2: Build context from chunks
    const { context, hasContext, sourceCount, sources } = buildRagContext(relevantChunks);

    // Notify frontend what was found
    res.write(`data: ${JSON.stringify({
      type: 'context_found',
      chunksFound: relevantChunks.length,
      sources: sources || []
    })}\n\n`);

    // Step 3: Build system prompt based on whether context was found
    const systemPrompt = hasContext
      ? RagPrompts.qa.build(context, sourceCount)
      : RagPrompts.qa.noContext;

    // Step 4: Stream AI answer
    const startTime = Date.now();
    let fullAnswer = '';

    await streamAI(
      systemPrompt,
      [],                    // No conversation history — context in system prompt
      question.trim(),

      // onChunk
      (chunk) => {
        fullAnswer += chunk;
        res.write(`data: ${JSON.stringify({
          type: 'chunk',
          content: chunk
        })}\n\n`);
      },

      // onDone
      ({ inputTokens, outputTokens }) => {
        const latencyMs = Date.now() - startTime;

        res.write(`data: ${JSON.stringify({
          type: 'done',
          tokens: { input: inputTokens, output: outputTokens },
          latencyMs,
          sources: sources || [],
          chunksUsed: relevantChunks.length
        })}\n\n`);
        res.end();
      },

      // onError
      (error) => {
        console.error('[RAG CHAT ERROR]', error.message);
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
    console.error('[RAG] Pipeline error:', error.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: error.message
      })}\n\n`);
      res.end();
    }
  }
});

// ── DELETE /api/rag/index/:documentId ─────────────────────────
// Remove document from vector store
router.delete('/index/:documentId', async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.documentId,
      userId: req.user.id
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    await removeDocumentFromIndex(req.params.documentId);

    res.json({
      success: true,
      message: 'Document removed from search index.'
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/rag/stats ─────────────────────────────────────────
// Vector store statistics
router.get('/stats', async (req, res) => {
  try {
    const [vectorStats, userChunkCount] = await Promise.all([
      getCollectionStats(),
      Chunk.countDocuments({ userId: req.user.id })
    ]);

    res.json({
      success: true,
      data: {
        totalChunksInStore: vectorStats.totalChunks,
        yourChunks: userChunkCount,
        embeddingProvider: process.env.EMBEDDING_PROVIDER || 'ollama'
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;