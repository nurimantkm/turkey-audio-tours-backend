import jwt from 'jsonwebtoken';

// Authentication middleware
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required',
      message: 'Please provide a valid access token'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      console.error('JWT verification error:', err);
      
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          message: 'Your session has expired. Please login again.'
        });
      }
      
      if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({
          success: false,
          error: 'Invalid token',
          message: 'The provided token is invalid'
        });
      }

      return res.status(403).json({
        success: false,
        error: 'Token verification failed',
        message: 'Unable to verify the provided token'
      });
    }

    req.user = user;
    next();
  });
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
};

// Admin authentication middleware
export const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    // For now, all authenticated users can perform admin actions
    // In production, you might want to add a role-based system
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Admin access requires authentication'
      });
    }

    // You can add admin role checking here
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Admin access required',
    //     message: 'This action requires admin privileges'
    //   });
    // }

    next();
  });
};

