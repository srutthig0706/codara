const { rateLimit } = require("express-rate-limit");

const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // max 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many AI requests from this client. Please wait 15 minutes before submitting more queries."
  }
});

const sandboxRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many code execution requests from this client. Please wait 15 minutes before submitting more runs."
  }
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Please try again in 15 minutes."
  }
});

module.exports = {
  aiRateLimiter,
  sandboxRateLimiter,
  authRateLimiter
};
