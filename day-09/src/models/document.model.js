import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({

  userId: {
    type: String,
    required: true,
    index: true
  },

  // Original file info
  originalName: {
    type: String,
    required: true,
    trim: true
  },

  mimeType: {
    type: String,
    required: true    // 'application/pdf' | 'text/plain'
  },

  fileSizeBytes: {
    type: Number,
    required: true
  },

  // Where file is stored
  // Local path for now — Day 56+ we move this to S3
  storagePath: {
    type: String,
    required: true
  },

  // Extracted text from the document
  // Stored in DB for quick access — no need to re-extract
  extractedText: {
    type: String,
    default: null
  },

  // Text extraction status
  extractionStatus: {
    type: String,
    enum: ['pending', 'processing', 'done', 'failed'],
    default: 'pending'
  },

  extractionError: {
    type: String,
    default: null
  },

  // Document stats — useful for UI display
  pageCount: {
    type: Number,
    default: null
  },

  wordCount: {
    type: Number,
    default: null
  },

  characterCount: {
    type: Number,
    default: null
  },

  // Estimated token count for AI context planning
  estimatedTokenCount: {
    type: Number,
    default: null
  },

  // Document vector index metadata
  isIndexed: {
    type: Boolean,
    default: false
  },

  indexedAt: {
    type: Date,
    default: null
  },

  // How many times this document was queried
  queryCount: {
    type: Number,
    default: 0
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Compound index for user's document list
documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, isActive: 1 });

export const Document = mongoose.model('Document', documentSchema);