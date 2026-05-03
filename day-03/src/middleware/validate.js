// Always validate BEFORE calling AI
// Bad input = wasted tokens = wasted money

export function validateTicketInput(req, res, next) {
  const { text, customerEmail } = req.body;

  const errors = [];

  // Check required fields
  if (!text) {
    errors.push('text is required');
  } else if (typeof text !== 'string') {
    errors.push('text must be a string');
  } else if (text.trim().length < 10) {
    errors.push('text must be at least 10 characters');
  } else if (text.length > 2000) {
    // Token cost protection — 2000 chars ≈ 500 tokens
    errors.push('text must not exceed 2000 characters');
  }

  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    errors.push('customerEmail is not a valid email');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors
    });
  }

  // Sanitize — trim whitespace before AI call
  req.body.text = text.trim();
  next();
}