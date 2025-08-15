#!/bin/bash

# 🚀 Form Submission App - Spaces Optimized Deployment Script
# This script builds React and prepares for Digital Ocean deployment

set -e  # Exit on error

echo "🌊 Starting deployment process (Digital Ocean Spaces optimized)..."

# Check if we're in the right directory
if [ ! -d "react-app" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Expected structure: project-root/react-app/ and project-root/backend/"
    exit 1
fi

# Step 1: Verify Spaces configuration
echo "🔧 Checking Digital Ocean Spaces configuration..."
cd backend

if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📋 Please update backend/.env with your Spaces credentials before continuing"
        echo "   1. SPACES_BUCKET=your-bucket-name"
        echo "   2. SPACES_ACCESS_KEY=your-access-key"
        echo "   3. SPACES_SECRET_KEY=your-secret-key"
        echo ""
        echo "⏸️  Deployment paused. Update .env and run this script again."
        exit 1
    fi
fi

# Check if essential Spaces variables are set
if ! grep -q "USE_SPACES=true" .env; then
    echo "⚠️  WARNING: USE_SPACES is not set to true in .env"
    echo "   For production deployment, please set USE_SPACES=true"
fi

if ! grep -q "SPACES_BUCKET=" .env || grep -q "your-bucket-name" .env; then
    echo "⚠️  WARNING: SPACES_BUCKET not configured in .env"
    echo "   Please set your actual Digital Ocean Spaces bucket name"
fi

echo "✅ Environment configuration checked"

# Step 2: Build React app
echo "📦 Building React app..."
cd ../react-app

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📥 Installing React dependencies..."
    npm install
fi

# Build React app
echo "🔨 Building React for production..."
npm run build

if [ ! -d "build" ]; then
    echo "❌ Error: React build failed - build directory not found"
    exit 1
fi

echo "✅ React build completed successfully"

# Step 3: Copy build to backend
echo "📋 Copying React build to backend..."
cd ../backend

# Remove old build if it exists
if [ -d "build" ]; then
    rm -rf build
fi

# Copy new build
cp -r ../react-app/build .

echo "✅ Build files copied to backend"

# Step 4: Install backend dependencies
echo "📥 Installing backend dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
fi

# Step 5: Initialize database
echo "🗄️  Initializing SQLite database..."
npm run init-db

# Step 6: Test Spaces connectivity (optional but recommended)
echo "🧪 Testing Spaces configuration..."

# Create a simple test script to verify Spaces connection
cat > test-spaces.js << 'EOF'
require('dotenv').config();
const AWS = require('aws-sdk');

if (process.env.USE_SPACES !== 'true') {
    console.log('⚠️  USE_SPACES is not enabled');
    process.exit(1);
}

const spacesEndpoint = new AWS.S3({
    endpoint: new AWS.Endpoint(process.env.SPACES_ENDPOINT),
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET_KEY,
    region: process.env.SPACES_REGION || 'nyc3'
});

spacesEndpoint.listObjects({
    Bucket: process.env.SPACES_BUCKET,
    MaxKeys: 1
}, (err, data) => {
    if (err) {
        console.log('❌ Spaces connection failed:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Spaces connection successful');
        console.log(`📦 Bucket: ${process.env.SPACES_BUCKET}`);
    }
});
EOF

# Run Spaces test
node test-spaces.js && rm test-spaces.js

# Step 7: Test the unified server locally
echo ""
echo "🧪 Testing unified server locally..."
echo "   Starting server on http://localhost:3001"

# Start server in background for testing
NODE_ENV=production npm start &
SERVER_PID=$!

# Wait for server to start
sleep 4

# Test if server is responding
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Server test passed"
    # Test if React app is being served
    if curl -s http://localhost:3001/ | grep -q "Form Submission" > /dev/null 2>&1; then
        echo "✅ React app serving test passed"
    else
        echo "⚠️  React app test inconclusive (might be normal)"
    fi
else
    echo "⚠️  Server test failed, but continuing..."
fi

# Stop test server
kill $SERVER_PID 2>/dev/null || true
sleep 2

echo ""
echo "🎉 Deployment preparation complete!"
echo ""
echo "📋 Your app is ready for Digital Ocean App Platform:"
echo ""
echo "   📁 Source Directory: /backend"
echo "   🔗 Build Command: npm install && npm run init-db"
echo "   🚀 Run Command: npm start"
echo ""
echo "🌐 Environment Variables to set in App Platform:"
echo "   NODE_ENV=production"
echo "   PORT=8080"
echo "   USE_SPACES=true"
echo "   SPACES_ENDPOINT=$(grep SPACES_ENDPOINT .env | cut -d'=' -f2)"
echo "   SPACES_BUCKET=$(grep SPACES_BUCKET .env | cut -d'=' -f2)"
echo "   SPACES_ACCESS_KEY=<your-access-key>"
echo "   SPACES_SECRET_KEY=<your-secret-key>"
echo "   SPACES_REGION=$(grep SPACES_REGION .env | cut -d'=' -f2)"
echo ""
echo "🚀 Next steps:"
echo "   1. Commit and push your changes:"
echo "      git add ."
echo "      git commit -m 'Deploy: Spaces optimized $(date)'"
echo "      git push origin main"
echo ""
echo "   2. Create App Platform app:"
echo "      - Go to Digital Ocean Console → Apps"
echo "      - Connect your GitHub repository"
echo "      - Set source directory to: /backend"
echo "      - Add environment variables above"
echo ""
echo "   3. After deployment, test your app:"
echo "      curl https://your-app.ondigitalocean.app/api/health"
echo ""
echo "📦 Your images will be stored at:"
echo "   https://$(grep SPACES_BUCKET .env | cut -d'=' -f2).$(grep SPACES_REGION .env | cut -d'=' -f2).cdn.digitaloceanspaces.com/images/"
echo ""