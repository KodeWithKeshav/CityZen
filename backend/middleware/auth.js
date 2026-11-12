const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Extract Bearer token from Authorization header (case-insensitive scheme).
 */
const extractBearerToken = (req) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
};

/**
 * Authentication middleware to validate JWT tokens
 * 
 * If a valid token is provided, the user information is attached to the request object.
 * If no token is provided or the token is invalid, the request continues but without user information.
 * This allows both authenticated and anonymous users to use the API.
 */
const authenticateUser = (req, res, next) => {
  try {
    const token = extractBearerToken(req);

    // If no token, continue as anonymous user
    if (!token) {
      req.user = null;
      req.authError = null;
      return next();
    }

    // Verify token - this is fast (no DB call)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || typeof decoded !== 'object' || !decoded.userId) {
      req.user = null;
      req.authError = 'InvalidTokenPayload';
      return next();
    }

    // Attach user to request directly from token
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      userType: decoded.userType,
      isAuthenticated: true
    };
    req.authError = null;

    next();
  } catch (error) {
    // Invalid or expired token - continue as anonymous so public/login routes still work
    logger.warn('JWT verification failed:', error.message);
    req.user = null;
    req.authError = error.name || 'InvalidToken';
    next();
  }
};

/**
 * Authorization middleware to restrict access to specific user types
 * @param {Array|string} allowedTypes - Allowed user types (e.g., ['admin', 'citizen'])
 */
const authorizeUserType = (allowedTypes) => {
  const types = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];
  return (req, res, next) => {
    // If user is not authenticated
    if (!req.user || !req.user.isAuthenticated) {
      const message = req.authError === 'TokenExpiredError'
        ? 'Token expired'
        : 'Authentication required';
      return res.status(401).json({
        success: false,
        message
      });
    }

    // Check if user type is allowed
    if (!types.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  };
};

module.exports = {
  authenticateUser,
  authorizeUserType
};
