const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Storage configuration - can switch between local and Spaces
const USE_SPACES = process.env.USE_SPACES === 'true';

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || true, // Allow all origins in production
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve React build files (for production)
if (process.env.NODE_ENV === 'production') {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, 'build')));
  console.log('📱 Serving React app from /build directory');
} else {
  console.log('🔧 Development mode - React served separately on port 3000');
}

// Serve uploaded images (for local storage only)
if (!USE_SPACES) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Database connection
const dbPath = path.join(__dirname, 'database', 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Configure Digital Ocean Spaces (S3-compatible)
let spacesEndpoint;
if (USE_SPACES) {
  spacesEndpoint = new AWS.S3({
    endpoint: new AWS.Endpoint(process.env.SPACES_ENDPOINT),
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET_KEY,
    region: process.env.SPACES_REGION || 'nyc3',
    s3ForcePathStyle: false,
    signatureVersion: 'v4'
  });

  console.log(`📦 Using Digital Ocean Spaces: ${process.env.SPACES_BUCKET}`);
} else {
  console.log('📁 Using local file storage');
}

// Configure multer for image uploads
let upload;

if (USE_SPACES) {
  // Digital Ocean Spaces upload configuration
  upload = multer({
    storage: multerS3({
      s3: spacesEndpoint,
      bucket: process.env.SPACES_BUCKET,
      acl: 'public-read',
      key: function (req, file, cb) {
        const uniqueName = `images/${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
      metadata: function (req, file, cb) {
        cb(null, {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString()
        });
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed!'));
      }
    }
  });
} else {
  // Local storage configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'uploads', 'images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });

  upload = multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed!'));
      }
    }
  });
}

// Utility function to validate image dimensions (for local files only)
async function validateImageSize(imagePath, maxWidth = 4000, maxHeight = 4000) {
  try {
    const metadata = await sharp(imagePath).metadata();
    
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      return {
        valid: false,
        message: `Image dimensions too large. Maximum allowed: ${maxWidth}x${maxHeight}px. Your image: ${metadata.width}x${metadata.height}px`
      };
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message: 'Invalid image file'
    };
  }
}

// API Routes (prefixed with /api to avoid conflicts with React routes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Form Submission Backend + React Frontend',
    storage: USE_SPACES ? 'Digital Ocean Spaces' : 'Local Storage',
    spaces_bucket: USE_SPACES ? process.env.SPACES_BUCKET : 'N/A'
  });
});

// Get all users (for gallery)
app.get('/api/users', (req, res) => {
  db.all(`
    SELECT 
      id, 
      name,
      image_url,
      created_at
    FROM users 
    ORDER BY created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err.message);
      res.status(500).json({ 
        success: false,
        error: 'Internal server error' 
      });
    } else {
      res.json({
        success: true,
        data: rows,
        count: rows.length,
        storage_type: USE_SPACES ? 'spaces' : 'local'
      });
    }
  });
});

// Get specific user by ID
app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`
    SELECT 
      id, 
      name,
      image_url,
      image_path,
      created_at
    FROM users 
    WHERE id = ?
  `, [id], (err, row) => {
    if (err) {
      console.error('Error fetching user:', err.message);
      res.status(500).json({ 
        success: false,
        error: 'Internal server error' 
      });
    } else if (!row) {
      res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    } else {
      res.json({
        success: true,
        data: row
      });
    }
  });
});

// Submit form with image upload
app.post('/api/submit', upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image is required'
      });
    }

    const userId = uuidv4();
    let imagePath, imageUrl;

    if (USE_SPACES) {
      // Digital Ocean Spaces
      imagePath = req.file.key;
      imageUrl = req.file.location;
      
      console.log(`📦 Image uploaded to Spaces: ${imageUrl}`);
    } else {
      // Local storage
      imagePath = req.file.path;
      imageUrl = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`;
      
      // Validate image dimensions for local files
      const imageValidation = await validateImageSize(req.file.path);
      if (!imageValidation.valid) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error('Error cleaning up file:', unlinkErr.message);
        }
        
        return res.status(400).json({
          success: false,
          error: imageValidation.message
        });
      }
      
      console.log(`📁 Image uploaded locally: ${imageUrl}`);
    }

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO users (id, name, image_path, image_url)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run([userId, name.trim(), imagePath, imageUrl], function(err) {
      if (err) {
        console.error('Error inserting user:', err.message);
        
        // Clean up uploaded file on error (local only)
        if (!USE_SPACES && req.file && req.file.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkErr) {
            console.error('Error cleaning up file:', unlinkErr.message);
          }
        }
        
        res.status(500).json({ 
          success: false,
          error: 'Internal server error' 
        });
      } else {
        const userData = {
          id: userId,
          name: name.trim(),
          image_url: imageUrl,
          created_at: new Date().toISOString(),
          storage_type: USE_SPACES ? 'spaces' : 'local'
        };

        console.log(`✅ New submission: ${userData.name}`);

        res.status(201).json({
          success: true,
          message: 'Form submitted successfully',
          data: userData
        });
      }
    });

    stmt.finalize();
  } catch (error) {
    console.error('Error in form submission:', error.message);
    
    // Clean up uploaded file on error (local only)
    if (!USE_SPACES && req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Error cleaning up file:', unlinkErr.message);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Serve React app for all non-API routes (this must be last!)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false,
        error: 'File too large. Maximum size is 10MB.' 
      });
    }
  }
  
  if (error.message === 'Only image files (JPG, PNG, GIF, WebP) are allowed!') {
    return res.status(400).json({ 
      success: false,
      error: 'Only image files (JPG, PNG, GIF, WebP) are allowed!' 
    });
  }

  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error' 
  });
});

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'API route not found' 
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Form Submission App running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Storage: ${USE_SPACES ? 'Digital Ocean Spaces' : 'Local Files'}`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log(`📱 React app: http://localhost:${PORT}/`);
    console.log(`🔗 API endpoints: http://localhost:${PORT}/api/*`);
  } else {
    console.log(`🔧 Development: Run React separately on port 3000`);
    console.log(`🔗 API endpoints: http://localhost:${PORT}/api/*`);
  }
});
