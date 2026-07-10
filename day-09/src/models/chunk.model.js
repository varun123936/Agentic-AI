import mongoose from 'mongoose';

// MongoDB record for each chunk
// The actual vector lives in ChromaDB
// This gives you metadata and allows linking chunks to documents

const chunkSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true
  },

  userId: {
    type: String,
    required: true,
    index: true
  },

  // Unique ID used in ChromaDB
  // Same ID in both MongoDB and ChromaDB for easy cross-reference
  chromaId: {
    type: String,
    required: true,
    unique: true
  },

  content: {
    type: String,
    required: true       // The actual text of this chunk
  },

  chunkIndex: {
    type: Number,
    required: true       // Position in original document
  },

  characterCount: {
    type: Number
  },

  // Which embedding model generated the vector
  embeddingModel: {
    type: String
  },

  embeddingProvider: {
    type: String        // 'ollama' | 'gemini'
  }

}, {
  timestamps: true
});

chunkSchema.index({ documentId: 1, chunkIndex: 1 });
chunkSchema.index({ chromaId: 1 });

export const Chunk = mongoose.model('Chunk', chunkSchema);