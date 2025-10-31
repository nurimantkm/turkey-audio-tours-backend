import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { query } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('first_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('First name must be between 1 and 100 characters'),
  body('last_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Last name must be between 1 and 100 characters')
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      is_premium: user.is_premium,
      subscription_type: user.subscription_type
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// POST /api/auth/register - Register new user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, first_name = '', last_name = '' } = req.body;

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, first_name, last_name, is_premium, subscription_type, created_at
    `, [email, password_hash, first_name, last_name]);

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          is_premium: user.is_premium,
          subscription_type: user.subscription_type,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user',
      message: error.message
    });
  }
});

// POST /api/auth/login - Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const result = await query(`
      SELECT id, email, password_hash, first_name, last_name, is_premium, subscription_type, created_at
      FROM users 
      WHERE email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          is_premium: user.is_premium,
          subscription_type: user.subscription_type,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login',
      message: error.message
    });
  }
});

// GET /api/auth/me - Get current user info (requires authentication)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, email, first_name, last_name, is_premium, subscription_type, created_at, updated_at
      FROM users 
      WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user info',
      message: error.message
    });
  }
});

// PUT /api/auth/profile - Update user profile (requires authentication)
router.put('/profile', authenticateToken, [
  body('first_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('First name must be between 1 and 100 characters'),
  body('last_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Last name must be between 1 and 100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { first_name, last_name, email } = req.body;
    const updates = {};
    const queryParams = [];
    let paramCount = 0;

    if (first_name !== undefined) {
      paramCount++;
      updates[`first_name = $${paramCount}`] = first_name;
      queryParams.push(first_name);
    }

    if (last_name !== undefined) {
      paramCount++;
      updates[`last_name = $${paramCount}`] = last_name;
      queryParams.push(last_name);
    }

    if (email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Email already taken',
          message: 'Another account is already using this email'
        });
      }

      paramCount++;
      updates[`email = $${paramCount}`] = email;
      queryParams.push(email);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }

    paramCount++;
    queryParams.push(req.user.id);

    const updateQuery = `
      UPDATE users 
      SET ${Object.keys(updates).join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, is_premium, subscription_type, created_at, updated_at
    `;

    const result = await query(updateQuery, queryParams);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      message: error.message
    });
  }
});

// POST /api/auth/change-password - Change user password (requires authentication)
router.post('/change-password', authenticateToken, [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { current_password, new_password } = req.body;

    // Get current user with password
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid current password'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const new_password_hash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await query(`
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [new_password_hash, req.user.id]);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
      message: error.message
    });
  }
});

export default router;

