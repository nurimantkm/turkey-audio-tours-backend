import express from 'express';
import { body, validationResult, param } from 'express-validator';
import { query } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware
const validateLocation = [
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Name is required and must be less than 255 characters'),
  body('description').optional().isLength({ max: 2000 }).withMessage('Description must be less than 2000 characters'),
  body('category').optional().isIn(['Architecture', 'Religion', 'History', 'Culture', 'Nature']).withMessage('Invalid category'),
  body('duration').optional().trim().isLength({ max: 50 }).withMessage('Duration must be less than 50 characters'),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
  body('listeners').optional().isInt({ min: 0 }).withMessage('Listeners must be a positive integer'),
  body('is_premium').optional().isBoolean().withMessage('is_premium must be a boolean'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
];

// GET /api/locations - Get all locations
router.get('/', async (req, res) => {
  try {
    const { category, is_premium, limit = 50, offset = 0 } = req.query;
    
    let queryText = `
      SELECT id, name, description, category, duration, rating, listeners, 
             is_premium, image_url, audio_url, latitude, longitude, 
             created_at, updated_at
      FROM locations 
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      queryText += ` AND category = $${paramCount}`;
      queryParams.push(category);
    }

    if (is_premium !== undefined) {
      paramCount++;
      queryText += ` AND is_premium = $${paramCount}`;
      queryParams.push(is_premium === 'true');
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locations',
      message: error.message
    });
  }
});

// GET /api/locations/:id - Get single location
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('Invalid location ID')
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

    const { id } = req.params;
    const result = await query(`
      SELECT id, name, description, category, duration, rating, listeners, 
             is_premium, image_url, audio_url, latitude, longitude, 
             created_at, updated_at
      FROM locations 
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch location',
      message: error.message
    });
  }
});

// POST /api/locations - Create new location (requires authentication)
router.post('/', authenticateToken, validateLocation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      name,
      description = '',
      category = 'Architecture',
      duration = '',
      rating = 0.0,
      listeners = 0,
      is_premium = false,
      image_url = '',
      audio_url = '',
      latitude = null,
      longitude = null
    } = req.body;

    const result = await query(`
      INSERT INTO locations (name, description, category, duration, rating, listeners, is_premium, image_url, audio_url, latitude, longitude, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, name, description, category, duration, rating, listeners, is_premium, image_url, audio_url, latitude, longitude, created_at, updated_at
    `, [name, description, category, duration, rating, listeners, is_premium, image_url, audio_url, latitude, longitude, req.user.id]);

    res.status(201).json({
      success: true,
      message: 'Location created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create location',
      message: error.message
    });
  }
});

// PUT /api/locations/:id - Update location (requires authentication)
router.put('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Invalid location ID'),
  ...validateLocation
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

    const { id } = req.params;
    const {
      name,
      description,
      category,
      duration,
      rating,
      listeners,
      is_premium,
      image_url,
      audio_url,
      latitude,
      longitude
    } = req.body;

    // Check if location exists
    const existingLocation = await query('SELECT id FROM locations WHERE id = $1', [id]);
    if (existingLocation.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    const result = await query(`
      UPDATE locations 
      SET name = $1, description = $2, category = $3, duration = $4, rating = $5, 
          listeners = $6, is_premium = $7, image_url = $8, audio_url = $9, 
          latitude = $10, longitude = $11, updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING id, name, description, category, duration, rating, listeners, is_premium, image_url, audio_url, latitude, longitude, created_at, updated_at
    `, [name, description, category, duration, rating, listeners, is_premium, image_url, audio_url, latitude, longitude, id]);

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update location',
      message: error.message
    });
  }
});

// DELETE /api/locations/:id - Delete location (requires authentication)
router.delete('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Invalid location ID')
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

    const { id } = req.params;

    // Check if location exists
    const existingLocation = await query('SELECT id FROM locations WHERE id = $1', [id]);
    if (existingLocation.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    await query('DELETE FROM locations WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete location',
      message: error.message
    });
  }
});

// GET /api/locations/stats - Get location statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const totalLocations = await query('SELECT COUNT(*) as count FROM locations');
    const premiumLocations = await query('SELECT COUNT(*) as count FROM locations WHERE is_premium = true');
    const categoryStats = await query(`
      SELECT category, COUNT(*) as count 
      FROM locations 
      GROUP BY category 
      ORDER BY count DESC
    `);
    const avgRating = await query('SELECT AVG(rating) as avg_rating FROM locations WHERE rating > 0');

    res.json({
      success: true,
      data: {
        total_locations: parseInt(totalLocations.rows[0].count),
        premium_locations: parseInt(premiumLocations.rows[0].count),
        free_locations: parseInt(totalLocations.rows[0].count) - parseInt(premiumLocations.rows[0].count),
        average_rating: parseFloat(avgRating.rows[0].avg_rating || 0).toFixed(1),
        categories: categoryStats.rows
      }
    });
  } catch (error) {
    console.error('Error fetching location stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch location statistics',
      message: error.message
    });
  }
});

export default router;

