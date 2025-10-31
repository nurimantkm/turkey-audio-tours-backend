import express from 'express';
import { body, validationResult, param } from 'express-validator';
import { query } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users/favorites - Get user's favorite locations (requires authentication)
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT l.id, l.name, l.description, l.category, l.duration, l.rating, 
             l.listeners, l.is_premium, l.image_url, l.audio_url, l.latitude, l.longitude,
             uf.created_at as favorited_at
      FROM user_favorites uf
      JOIN locations l ON uf.location_id = l.id
      WHERE uf.user_id = $1
      ORDER BY uf.created_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching user favorites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch favorites',
      message: error.message
    });
  }
});

// POST /api/users/favorites/:locationId - Add location to favorites (requires authentication)
router.post('/favorites/:locationId', authenticateToken, [
  param('locationId').isInt({ min: 1 }).withMessage('Invalid location ID')
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

    const { locationId } = req.params;

    // Check if location exists
    const locationExists = await query('SELECT id FROM locations WHERE id = $1', [locationId]);
    if (locationExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    // Check if already favorited
    const existingFavorite = await query(
      'SELECT id FROM user_favorites WHERE user_id = $1 AND location_id = $2',
      [req.user.id, locationId]
    );

    if (existingFavorite.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Location already in favorites'
      });
    }

    // Add to favorites
    await query(
      'INSERT INTO user_favorites (user_id, location_id) VALUES ($1, $2)',
      [req.user.id, locationId]
    );

    res.status(201).json({
      success: true,
      message: 'Location added to favorites'
    });
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to favorites',
      message: error.message
    });
  }
});

// DELETE /api/users/favorites/:locationId - Remove location from favorites (requires authentication)
router.delete('/favorites/:locationId', authenticateToken, [
  param('locationId').isInt({ min: 1 }).withMessage('Invalid location ID')
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

    const { locationId } = req.params;

    const result = await query(
      'DELETE FROM user_favorites WHERE user_id = $1 AND location_id = $2',
      [req.user.id, locationId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Favorite not found'
      });
    }

    res.json({
      success: true,
      message: 'Location removed from favorites'
    });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove from favorites',
      message: error.message
    });
  }
});

// GET /api/users/progress - Get user's progress on locations (requires authentication)
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT l.id, l.name, l.category, l.duration, l.image_url,
             up.progress_percentage, up.completed, up.last_position, up.updated_at
      FROM user_progress up
      JOIN locations l ON up.location_id = l.id
      WHERE up.user_id = $1
      ORDER BY up.updated_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching user progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch progress',
      message: error.message
    });
  }
});

// PUT /api/users/progress/:locationId - Update progress for a location (requires authentication)
router.put('/progress/:locationId', authenticateToken, [
  param('locationId').isInt({ min: 1 }).withMessage('Invalid location ID'),
  body('progress_percentage').isInt({ min: 0, max: 100 }).withMessage('Progress percentage must be between 0 and 100'),
  body('completed').optional().isBoolean().withMessage('Completed must be a boolean'),
  body('last_position').optional().isInt({ min: 0 }).withMessage('Last position must be a positive integer')
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

    const { locationId } = req.params;
    const { progress_percentage, completed = false, last_position = 0 } = req.body;

    // Check if location exists
    const locationExists = await query('SELECT id FROM locations WHERE id = $1', [locationId]);
    if (locationExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    // Upsert progress
    const result = await query(`
      INSERT INTO user_progress (user_id, location_id, progress_percentage, completed, last_position)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, location_id)
      DO UPDATE SET 
        progress_percentage = EXCLUDED.progress_percentage,
        completed = EXCLUDED.completed,
        last_position = EXCLUDED.last_position,
        updated_at = CURRENT_TIMESTAMP
      RETURNING progress_percentage, completed, last_position, updated_at
    `, [req.user.id, locationId, progress_percentage, completed, last_position]);

    res.json({
      success: true,
      message: 'Progress updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update progress',
      message: error.message
    });
  }
});

// PUT /api/users/subscription - Update user subscription (requires authentication)
router.put('/subscription', authenticateToken, [
  body('subscription_type').isIn(['free', 'premium', 'pro']).withMessage('Invalid subscription type'),
  body('is_premium').isBoolean().withMessage('is_premium must be a boolean')
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

    const { subscription_type, is_premium } = req.body;

    const result = await query(`
      UPDATE users 
      SET subscription_type = $1, is_premium = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, email, first_name, last_name, is_premium, subscription_type, updated_at
    `, [subscription_type, is_premium, req.user.id]);

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: {
        user: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update subscription',
      message: error.message
    });
  }
});

// GET /api/users/stats - Get user statistics (requires authentication)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const favoritesCount = await query(
      'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = $1',
      [req.user.id]
    );

    const progressStats = await query(`
      SELECT 
        COUNT(*) as total_started,
        COUNT(CASE WHEN completed = true THEN 1 END) as completed_count,
        AVG(progress_percentage) as avg_progress
      FROM user_progress 
      WHERE user_id = $1
    `, [req.user.id]);

    const recentActivity = await query(`
      SELECT l.name, l.category, up.progress_percentage, up.completed, up.updated_at
      FROM user_progress up
      JOIN locations l ON up.location_id = l.id
      WHERE up.user_id = $1
      ORDER BY up.updated_at DESC
      LIMIT 5
    `, [req.user.id]);

    res.json({
      success: true,
      data: {
        favorites_count: parseInt(favoritesCount.rows[0].count),
        total_started: parseInt(progressStats.rows[0].total_started || 0),
        completed_count: parseInt(progressStats.rows[0].completed_count || 0),
        average_progress: parseFloat(progressStats.rows[0].avg_progress || 0).toFixed(1),
        recent_activity: recentActivity.rows
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics',
      message: error.message
    });
  }
});

export default router;

