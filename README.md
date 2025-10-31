# Turkey Audio Tours - Backend API

Complete Node.js/Express backend API for the Turkey Audio Tours v3 platform.

## 🚀 Features

- **RESTful API** - Complete CRUD operations for locations and users
- **Authentication** - JWT-based user authentication and authorization
- **Database Integration** - PostgreSQL with connection pooling
- **Security** - Helmet, CORS, rate limiting, input validation
- **Admin Panel Support** - API endpoints for admin functionality
- **User Management** - Registration, login, profile management
- **Location Management** - CRUD operations with categories and ratings
- **Favorites System** - Users can favorite locations
- **Progress Tracking** - Track user progress through audio tours
- **Subscription Management** - Premium/Pro subscription support

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password

### Locations
- `GET /api/locations` - Get all locations (with filtering)
- `GET /api/locations/:id` - Get single location
- `POST /api/locations` - Create new location (auth required)
- `PUT /api/locations/:id` - Update location (auth required)
- `DELETE /api/locations/:id` - Delete location (auth required)
- `GET /api/locations/stats/overview` - Get location statistics

### Users
- `GET /api/users/favorites` - Get user favorites (auth required)
- `POST /api/users/favorites/:locationId` - Add to favorites (auth required)
- `DELETE /api/users/favorites/:locationId` - Remove from favorites (auth required)
- `GET /api/users/progress` - Get user progress (auth required)
- `PUT /api/users/progress/:locationId` - Update progress (auth required)
- `PUT /api/users/subscription` - Update subscription (auth required)
- `GET /api/users/stats` - Get user statistics (auth required)

### Health Check
- `GET /health` - API health check

## 🛠 Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Setup

1. **Clone and install dependencies:**
```bash
cd turkey-audio-tours-backend
npm install
```

2. **Environment Configuration:**
```bash
cp .env.example .env
# Edit .env with your database credentials and configuration
```

3. **Database Setup:**
- Create a PostgreSQL database
- Update DATABASE_URL in .env file
- The application will automatically create tables on first run

4. **Start Development Server:**
```bash
npm run dev
```

5. **Production Start:**
```bash
npm start
```

## 🔧 Environment Variables

Required environment variables (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS

## 🗄 Database Schema

### Users Table
- User authentication and profile information
- Subscription management (free/premium/pro)
- Created/updated timestamps

### Locations Table
- Audio tour locations with metadata
- Categories, ratings, duration, listeners count
- Premium content flagging
- GPS coordinates for mapping

### User Favorites Table
- Many-to-many relationship between users and locations
- Tracks user's favorite locations

### User Progress Table
- Tracks user progress through audio tours
- Progress percentage, completion status
- Last position for resuming tours

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. **Register/Login** to receive a JWT token
2. **Include token** in Authorization header: `Bearer <token>`
3. **Token expires** in 7 days (configurable)

## 📊 API Response Format

All API responses follow this consistent format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "error": null
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message",
  "details": [ ... ]
}
```

## 🚀 Deployment

### Render Deployment

1. **Create Render Account** and connect GitHub repository
2. **Create Web Service** with these settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node
3. **Add Environment Variables** in Render dashboard
4. **Create PostgreSQL Database** in Render
5. **Deploy** - Render will automatically build and deploy

### Environment Variables for Production:
- `DATABASE_URL` - Provided by Render PostgreSQL
- `JWT_SECRET` - Generate strong secret key
- `NODE_ENV=production`
- `FRONTEND_URL` - Your frontend domain

## 🔧 Development

### Project Structure
```
turkey-audio-tours-backend/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── .env.example          # Environment variables template
├── database/
│   └── db.js             # Database connection and initialization
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── locations.js      # Location CRUD routes
│   └── users.js          # User management routes
├── middleware/
│   └── auth.js           # Authentication middleware
└── README.md             # This file
```

### Adding New Features

1. **Create new route files** in `/routes` directory
2. **Add middleware** in `/middleware` directory if needed
3. **Update database schema** in `database/db.js`
4. **Import and use routes** in `server.js`
5. **Update API documentation** in README.md

## 🧪 Testing

Health check endpoint for testing:
```bash
curl http://localhost:3001/health
```

API testing:
```bash
# Register user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get locations
curl http://localhost:3001/api/locations
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📞 Support

For issues and questions:
- GitHub Issues: [Repository Issues](https://github.com/nurimantkm/voyce1/issues)
- Documentation: This README and API endpoint documentation

