#!/bin/bash

# 🔧 Fix Digital Ocean Spaces AWS SDK Error
# This script fixes the "this.client.send is not a function" error

echo "🔧 Fixing Digital Ocean Spaces configuration..."

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    echo "   cd backend && bash fix-spaces.sh"
    exit 1
fi

# Step 1: Remove problematic node_modules
echo "🧹 Cleaning up existing installations..."
rm -rf node_modules
rm -f package-lock.json

# Step 2: Update package.json with correct versions
echo "📦 Updating package.json with compatible versions..."

# Create a temporary package.json fix
cat > package.json << 'EOF'
{
  "name": "form-submission-backend",
  "version": "1.0.0",
  "description": "Express backend for form submissions with React frontend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "init-db": "node init-db.js",
    "build-react": "cd ../react-app && npm install && npm run build && cp -r build ../backend/",
    "build": "npm install && npm run build-react && npm run init-db",
    "deploy": "npm run build && git add . && git commit -m 'Deploy update' && git push",
    "test-local": "NODE_ENV=production npm start"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "multer": "^1.4.5-lts.1",
    "multer-s3": "^2.10.0",
    "aws-sdk": "^2.1490.0",
    "cors": "^2.8.5",
    "uuid": "^9.0.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Step 3: Clean install with correct versions
echo "📥 Installing compatible packages..."
npm install

# Step 4: Test the configuration
echo "🧪 Testing Spaces configuration..."

if [ -f ".env" ] && grep -q "USE_SPACES=true" .env; then
    echo "✅ Spaces configuration found in .env"
    
    # Create test script
    cat > test-spaces-config.js << 'EOF'
require('dotenv').config();
const AWS = require('aws-sdk');

console.log('🧪 Testing Digital Ocean Spaces configuration...');

if (process.env.USE_SPACES !== 'true') {
    console.log('⚠️  USE_SPACES is not enabled in .env');
    process.exit(1);
}

// Test required environment variables
const required = ['SPACES_ENDPOINT', 'SPACES_BUCKET', 'SPACES_ACCESS_KEY', 'SPACES_SECRET_KEY'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing.join(', '));
    process.exit(1);
}

// Test AWS SDK configuration
try {
    AWS.config.update({
        accessKeyId: process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
        region: process.env.SPACES_REGION || 'nyc3'
    });

    const s3 = new AWS.S3({
        endpoint: new AWS.Endpoint(process.env.SPACES_ENDPOINT),
        s3ForcePathStyle: false,
        signatureVersion: 'v4'
    });

    // Test connection
    s3.listObjects({
        Bucket: process.env.SPACES_BUCKET,
        MaxKeys: 1
    }, (err, data) => {
        if (err) {
            console.log('❌ Spaces connection failed:', err.message);
            console.log('   Check your credentials and bucket name');
        } else {
            console.log('✅ Spaces connection successful!');
            console.log(`📦 Bucket: ${process.env.SPACES_BUCKET}`);
            console.log(`🌐 Endpoint: ${process.env.SPACES_ENDPOINT}`);
        }
    });
} catch (error) {
    console.log('❌ Configuration error:', error.message);
}
EOF

    # Run test
    node test-spaces-config.js
    
    # Clean up test file
    rm test-spaces-config.js
    
else
    echo "⚠️  No .env file found or USE_SPACES not set to true"
    echo "   Please create .env file and configure Spaces credentials"
fi

echo ""
echo "🎉 Dependency fix complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure your .env file has correct Spaces credentials"
echo "   2. Test the server: npm run dev"
echo "   3. Try uploading an image through your form"
echo ""
echo "🔧 If you still get errors:"
echo "   1. Double-check your Spaces bucket name and region"
echo "   2. Verify your API keys have proper permissions"
echo "   3. Ensure your bucket allows public-read ACL"
echo ""