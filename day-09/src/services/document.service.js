import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { Document } from '../models/document.model.js';

// ── Extract text from uploaded file ──────────────────────────
export async function extractTextFromFile(filePath, mimeType) {
  const result = {
    text: '',
    pageCount: null,
    wordCount: 0,
    characterCount: 0,
    estimatedTokenCount: 0
  };

  if (mimeType === 'application/pdf') {
    // Read file buffer
    const fileBuffer = fs.readFileSync(filePath);

    // Parse PDF
    const pdfData = await pdfParse(fileBuffer);

    result.text = pdfData.text;
    result.pageCount = pdfData.numpages;

  } else {
    // Plain text / markdown — read directly
    result.text = fs.readFileSync(filePath, 'utf-8');
    result.pageCount = null;
  }

  // Clean extracted text
  // PDF extraction often has extra whitespace and weird characters
  result.text = cleanExtractedText(result.text);

  // Calculate stats
  result.characterCount = result.text.length;
  result.wordCount = result.text.split(/\s+/).filter(Boolean).length;

  // Rough token estimate: 1 token ≈ 4 characters
  // Gemini 2.5 Flash limit: 1M tokens
  result.estimatedTokenCount = Math.ceil(result.characterCount / 4);

  return result;
}

// ── Clean raw extracted text ──────────────────────────────────
function cleanExtractedText(text) {
  return text
    .replace(/\r\n/g, '\n')          // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')      // Collapse multiple blank lines
    .replace(/[ \t]{2,}/g, ' ')      // Collapse multiple spaces
    .replace(/[^\S\n]+$/gm, '')      // Remove trailing whitespace per line
    .trim();
}

// ── Save document record to MongoDB ──────────────────────────
export async function saveDocument(userId, fileInfo, extractionResult) {
  const document = await Document.create({
    userId,
    originalName: fileInfo.originalname,
    mimeType: fileInfo.mimetype,
    fileSizeBytes: fileInfo.size,
    storagePath: fileInfo.path,
    extractedText: extractionResult.text,
    extractionStatus: 'done',
    pageCount: extractionResult.pageCount,
    wordCount: extractionResult.wordCount,
    characterCount: extractionResult.characterCount,
    estimatedTokenCount: extractionResult.estimatedTokenCount
  });

  return document;
}

// ── Get document (with ownership check) ──────────────────────
export async function getDocument(documentId, userId) {
  let document;

  try {
    document = await Document.findOne({
      _id: documentId,
      userId,
      isActive: true
    });
  } catch (error) {
    const err = new Error('Invalid document ID');
    err.statusCode = 400;
    throw err;
  }

  if (!document) {
    const err = new Error('Document not found');
    err.statusCode = 404;
    throw err;
  }

  return document;
}

// ── Get all documents for a user ──────────────────────────────
export async function getUserDocuments(userId) {
  return Document.find({ userId, isActive: true })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('originalName mimeType fileSizeBytes pageCount wordCount estimatedTokenCount queryCount createdAt');
}

// ── Build AI prompt for document Q&A ─────────────────────────
export function buildDocumentQAPrompt(documentText, documentName) {
  // Truncate if document is extremely large
  // 800k chars ≈ 200k tokens — safe for Gemini 2.5 Flash
  const MAX_CHARS = 800_000;
  const truncated = documentText.length > MAX_CHARS;
  const contextText = truncated
    ? documentText.substring(0, MAX_CHARS) + '\n\n[Document truncated due to length]'
    : documentText;

  return {
    system: `You are a document analysis assistant. 
You have been given the full text of a document called "${documentName}".
Your job is to answer questions about this document accurately.

Rules:
- Only answer based on information in the document
- If the answer is not in the document, clearly say "This information is not in the document"
- Quote relevant sections when helpful
- Be concise and direct
- If asked for a summary, provide key points in bullet format

Document Content:
─────────────────────────────────────
${contextText}
─────────────────────────────────────`,

    wasTruncated: truncated
  };
}

// —— Load multiple documents with ownership validation —————————————
export async function getDocumentsByIds(documentIds, userId) {
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    const err = new Error('documentIds must be a non-empty array');
    err.statusCode = 400;
    throw err;
  }

  const uniqueIds = [...new Set(documentIds)];
  const documents = [];

  for (const documentId of uniqueIds) {
    const document = await getDocument(documentId, userId);
    documents.push(document);
  }

  return documents;
}

// —— Build AI prompt for multi-document Q&A ———————————————————————
export function buildMultiDocumentQAPrompt(documents) {
  const MAX_CHARS = 800_000;
  let currentLength = 0;
  let wasTruncated = false;

  const labeledDocuments = documents.map((document, index) => {
    const label = `Document ${index + 1}: ${document.originalName}`;
    const sectionHeader = `${label}\n${'—'.repeat(Math.min(label.length, 60))}\n`;
    const remainingChars = MAX_CHARS - currentLength - sectionHeader.length;

    let content = document.extractedText || '';
    if (remainingChars <= 0) {
      wasTruncated = true;
      content = '[Document content omitted due to combined length]';
    } else if (content.length > remainingChars) {
      wasTruncated = true;
      content = `${content.substring(0, remainingChars)}\n\n[Document truncated due to combined length]`;
    }

    currentLength += sectionHeader.length + content.length + 2;
    return `${sectionHeader}${content}`;
  });

  return {
    system: `You are a document analysis assistant.
You have been given multiple documents.
Your job is to answer questions accurately using only the provided documents.

Rules:
- Only answer based on information in the provided documents
- Clearly mention which document(s) support your answer when helpful
- If the answer is not in the documents, clearly say "This information is not in the provided documents"
- If documents disagree, say so explicitly
- Be concise and direct

Documents:
═══════════════════════════════════════
${labeledDocuments.join('\n\n')}
═══════════════════════════════════════`,
    wasTruncated
  };
}

// ── Soft delete a document ────────────────────────────────────
export async function deleteDocument(documentId, userId) {
  const document = await Document.findOneAndUpdate(
    { _id: documentId, userId },
    { isActive: false },
    { new: true }
  );

  if (!document) {
    const err = new Error('Document not found');
    err.statusCode = 404;
    throw err;
  }

  // In production: also remove from S3
  // For now: keep local file, just mark inactive
  return document;
}
