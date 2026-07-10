import fetch from 'node-fetch';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

// ── Generate embedding for a single text ─────────────────────
// Only Ollama now — no Gemini embedding branch needed
export async function generateEmbedding(text) {
  return generateOllamaEmbedding(text);
}

// ── Generate embeddings for multiple texts (batch) ────────────
export async function generateEmbeddings(texts) {
  // Process in batches to avoid overwhelming local Ollama server
  const BATCH_SIZE = 10;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    // Process batch in parallel — local Ollama can handle concurrent requests
    const batchEmbeddings = await Promise.all(
      batch.map(text => generateOllamaEmbedding(text))
    );

    allEmbeddings.push(...batchEmbeddings);

    // Small delay between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return allEmbeddings;
}

// ── Ollama embedding (local, free, nomic-embed-text) ──────────
async function generateOllamaEmbedding(text) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_EMBED_MODEL,
        prompt: text   // Ollama uses 'prompt' field, not 'input'
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding response from Ollama');
    }

    return {
      embedding: data.embedding,        // nomic-embed-text produces 768-dimension vectors
      model: OLLAMA_EMBED_MODEL,
      provider: 'ollama',
      dimensions: data.embedding.length
    };

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Ollama is not running. Start it with: ollama serve');
    }
    throw error;
  }
}

// ── Cosine similarity (optional manual comparison utility) ────
export function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
}