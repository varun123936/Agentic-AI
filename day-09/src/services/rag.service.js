import { v4 as uuidv4 } from 'uuid';
import { generateEmbedding, generateEmbeddings } from './embedding.service.js';
import { storeChunks, searchSimilarChunks, deleteDocumentChunks } from './vectorstore.service.js';
import { Chunk } from '../models/chunk.model.js';

// ── INDEXING: Split text into overlapping chunks ──────────────
export function chunkText(text, options = {}) {
  const {
    chunkSize = parseInt(process.env.CHUNK_SIZE || '500'),
    overlap = parseInt(process.env.CHUNK_OVERLAP || '50')
  } = options;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks = [];
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + chunkSize, words.length);
    const chunkWords = words.slice(startIndex, endIndex);
    const chunkText = chunkWords.join(' ');

    chunks.push({
      text: chunkText,
      wordCount: chunkWords.length,
      startWord: startIndex,
      endWord: endIndex
    });

    startIndex += chunkSize - overlap;
    if (endIndex >= words.length) break;
  }

  return chunks;
}

// ── INDEXING: Index a document into Chroma Cloud ──────────────
export async function indexDocument(document, userId) {
  console.log(`[RAG] Indexing document: ${document.originalName}`);

  const textChunks = chunkText(document.extractedText);
  console.log(`[RAG] Created ${textChunks.length} chunks`);

  if (textChunks.length === 0) {
    throw new Error('No text chunks created from document');
  }

  console.log(`[RAG] Generating embeddings via Ollama (nomic-embed-text)...`);
  // No provider argument needed anymore — embedding.service.js only uses Ollama
  const embeddingResults = await generateEmbeddings(
    textChunks.map(c => c.text)
  );

  const documentId = document._id.toString();
  const chromaChunks = [];
  const mongoChunks = [];

  for (let i = 0; i < textChunks.length; i++) {
    const chromaId = uuidv4();

    chromaChunks.push({
      id: chromaId,
      text: textChunks[i].text,
      embedding: embeddingResults[i].embedding,
      metadata: {
        documentId,
        userId,
        chunkIndex: i,
        documentName: document.originalName,
        wordCount: textChunks[i].wordCount
      }
    });

    mongoChunks.push({
      documentId,
      userId,
      chromaId,
      content: textChunks[i].text,
      chunkIndex: i,
      characterCount: textChunks[i].text.length,
      embeddingModel: embeddingResults[i].model,
      embeddingProvider: embeddingResults[i].provider
    });
  }

  // Store in Chroma Cloud (vectors) and MongoDB (metadata)
  await storeChunks(chromaChunks);
  await Chunk.insertMany(mongoChunks);

  console.log(`[RAG] Indexed ${textChunks.length} chunks successfully to Chroma Cloud`);

  return {
    chunksCreated: textChunks.length,
    embeddingProvider: embeddingResults[0].provider,
    embeddingModel: embeddingResults[0].model,
    embeddingDimensions: embeddingResults[0].dimensions
  };
}

// ── QUERY: Find relevant chunks for a question ────────────────
export async function retrieveRelevantChunks(question, options = {}) {
  const {
    userId,
    documentId,
    topK = parseInt(process.env.RAG_TOP_K || '5'),
    minScore = 0.3
  } = options;

  const questionEmbedding = await generateEmbedding(question);

  const similarChunks = await searchSimilarChunks(
    questionEmbedding.embedding,
    { userId, documentId, topK, minScore }
  );

  return similarChunks;
}

// ── Build RAG context from retrieved chunks ───────────────────
export function buildRagContext(chunks) {
  if (chunks.length === 0) {
    return { context: '', hasContext: false };
  }

  const contextParts = chunks.map((chunk, index) => {
    const score = (chunk.similarityScore * 100).toFixed(0);
    const docName = chunk.metadata.documentName || 'Unknown Document';

    return `[Source ${index + 1}: ${docName} | Relevance: ${score}%]
${chunk.text}`;
  });

  return {
    context: contextParts.join('\n\n─────────────────\n\n'),
    hasContext: true,
    sourceCount: chunks.length,
    sources: chunks.map(c => ({
      documentName: c.metadata.documentName,
      documentId: c.metadata.documentId,
      similarityScore: c.similarityScore
    }))
  };
}

// ── Remove document from vector store ────────────────────────
export async function removeDocumentFromIndex(documentId) {
  await deleteDocumentChunks(documentId);
  await Chunk.deleteMany({ documentId });
  console.log(`[RAG] Removed chunks for document: ${documentId}`);
}