import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// Database query helper
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query executed:', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
};

// Initialize database tables
export const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database tables...');

    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_premium BOOLEAN DEFAULT FALSE,
        subscription_type VARCHAR(50) DEFAULT 'free',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create locations table
    await query(`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) DEFAULT 'Architecture',
        duration VARCHAR(50),
        rating DECIMAL(2,1) DEFAULT 0.0,
        listeners INTEGER DEFAULT 0,
        is_premium BOOLEAN DEFAULT FALSE,
        image_url TEXT,
        audio_url TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id)
      )
    `);

    // Create user_favorites table
    await query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, location_id)
      )
    `);

    // Create user_progress table
    await query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
        progress_percentage INTEGER DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        last_position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, location_id)
      )
    `);

    // Insert default locations if table is empty
    const locationCount = await query('SELECT COUNT(*) FROM locations');
    if (parseInt(locationCount.rows[0].count) === 0) {
      console.log('📍 Inserting default locations...');
      
      const defaultLocations = [
        {
          name: 'Hagia Sophia',
          description: 'A masterpiece of Byzantine architecture that has served as both a cathedral and mosque...',
          category: 'Architecture',
          duration: '8 min',
          rating: 4.9,
          listeners: 2100,
          is_premium: false,
          image_url: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=800',
          latitude: 41.0086,
          longitude: 28.9802
        },
        {
          name: 'Blue Mosque',
          description: 'The Sultan Ahmed Mosque, known as the Blue Mosque for its beautiful blue tiles...',
          category: 'Religion',
          duration: '6 min',
          rating: 4.8,
          listeners: 1850,
          is_premium: false,
          image_url: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800',
          latitude: 41.0054,
          longitude: 28.9768
        },
        {
          name: 'Topkapi Palace',
          description: 'Former residence of Ottoman sultans, now a museum showcasing imperial collections...',
          category: 'History',
          duration: '12 min',
          rating: 4.7,
          listeners: 1650,
          is_premium: true,
          image_url: 'https://images.unsplash.com/photo-1570939274717-7eda259b50ed?w=800',
          latitude: 41.0115,
          longitude: 28.9833
        },
        {
          name: 'Galata Tower',
          description: 'A medieval stone tower offering panoramic views of Istanbul and the Golden Horn...',
          category: 'Architecture',
          duration: '10 min',
          rating: 4.7,
          listeners: 1800,
          is_premium: false,
          image_url: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800',
          latitude: 41.0256,
          longitude: 28.9744
        }
      ];

      for (const location of defaultLocations) {
        await query(`
          INSERT INTO locations (name, description, category, duration, rating, listeners, is_premium, image_url, latitude, longitude)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          location.name,
          location.description,
          location.category,
          location.duration,
          location.rating,
          location.listeners,
          location.is_premium,
          location.image_url,
          location.latitude,
          location.longitude
        ]);
      }
    }

    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// Export pool for direct access if needed
export default pool;

