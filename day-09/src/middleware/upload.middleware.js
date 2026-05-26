import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = process.env.UPLOAD_DIR || 'uploads';

// Ensure uploads directory exists
const uploadDir = path.resolve(__dirname, '../../', uploadRoot);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    // userId_timestamp_originalname
    // Prevents filename collisions
    const userId = req.user?.id || 'unknown';
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${userId}_${timestamp}_${safeName}`);
  }
});

// File filter — only allow specific types
function fileFilter(req, file, cb) {
  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'text/markdown'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);   // Accept file
  } else {
    cb(new Error(`File type not supported: ${file.mimetype}. Allowed: PDF, TXT, MD`), false);
  }
}

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10');

// Export configured multer instance
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,   // Convert MB to bytes
    files: 1                                 // One file at a time
  }
});

// Error handler specifically for multer errors
// Multer throws its own error types — catch them here
export function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${MAX_SIZE_MB}MB.`,
        code: 'FILE_TOO_LARGE'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Only one file allowed per upload.',
        code: 'TOO_MANY_FILES'
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'UPLOAD_ERROR'
    });
  }

  // File type rejection from fileFilter
  if (err.message?.includes('File type not supported')) {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'INVALID_FILE_TYPE'
    });
  }

  next(err);
}
