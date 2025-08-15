# 📝 Form Submission App

A modern full-stack form submission application with image upload functionality, built with React and Express, optimized for Digital Ocean Spaces.

## 🌟 Features

- ✅ **Beautiful React Form** - Drag & drop image upload with preview
- ✅ **Express API Backend** - RESTful API with SQLite database
- ✅ **Digital Ocean Spaces** - Cloud image storage with CDN
- ✅ **Single App Deployment** - Unified React + Express hosting
- ✅ **Professional Architecture** - Production-ready setup
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile

## 🏗️ Tech Stack

### **Frontend**
- **React 18** - Modern UI framework
- **Axios** - HTTP client for API calls
- **React Dropzone** - Drag & drop file uploads
- **CSS3** - Custom responsive styling

### **Backend** 
- **Express.js** - Web application framework
- **SQLite** - Lightweight database
- **Multer + MulterS3** - File upload handling
- **AWS SDK** - Digital Ocean Spaces integration

### **Infrastructure**
- **Digital Ocean Spaces** - Cloud file storage + CDN
- **Digital Ocean App Platform** - Hosting and deployment

## 📁 Project Structure

```
form-submission-project/
├── backend/                    # 🖥️ Express server (DEPLOY THIS)
│   ├── database/              # 🗄️ SQLite database (auto-created)
│   ├── build/                 # 📱 React build files (auto-copied)
│   ├── server.js              # 🚀 Main server file
│   ├── init-db.js             # 🔧 Database initialization
│   ├── package.json           # 📦 Dependencies & scripts
│   └── .env                   # 🔒 Environment variables
└── react-app/                 # ⚛️ React frontend source
    ├── src/                   # 📝 Source code
    ├── public/                # 🌐 Public assets
    └── package.json           # 📦 React dependencies
```

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+ installed
- Digital Ocean account
- Git for version control

### **1. Clone & Setup**
```bash
# Clone repository
git clone <your-repo-url>
cd form-submission-project

# Setup backend
cd backend
npm install
cp .env.example .env

# Setup React app
cd ../react-app
npm install
```

### **2. Configure Digital Ocean Spaces**
1. **Create Space:** https://cloud.digitalocean.com/spaces
2. **Generate API Keys:** https://cloud.digitalocean.com/account/api/tokens
3. **Update backend/.env:**
   ```bash
   USE_SPACES=true
   SPACES_BUCKET=your-bucket-name
   SPACES_ACCESS_KEY=your-access-key
   SPACES_SECRET_KEY=your-secret-key
   ```

### **3. Initialize Database**
```bash
cd backend
npm run init-db
```

### **4. Start Development**
```bash
# Terminal 1: Backend (port 3001)
cd backend
npm run dev

# Terminal 2: React (port 3000)
cd react-app
npm start
```

Visit: http://localhost:3000

## 🌐 Production Deployment

### **Option 1: Automated Deployment Script**
```bash
# From project root
chmod +x deploy.sh
./deploy.sh

# Then commit and push
git add .
git commit -m "Deploy to production"
git push origin main
```

### **Option 2: Manual App Platform Setup**

1. **Create App Platform App**
   - Go to Digital Ocean Console → Apps
   - Connect your GitHub repository
   - Choose `/backend` as source directory

2. **Configure Environment Variables**
   ```
   NODE_ENV=production
   PORT=8080
   USE_SPACES=true
   SPACES_BUCKET=your-bucket-name
   SPACES_ACCESS_KEY=your-access-key
   SPACES_SECRET_KEY=your-secret-key
   ```

3. **Deploy**
   - App Platform will automatically build and deploy
   - Your app will be live at: `https://your-app.ondigitalocean.app`

## 🔧 Environment Configuration

### **Backend (.env)**
```bash
# Storage
USE_SPACES=true

# Digital Ocean Spaces
SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
SPACES_BUCKET=your-form-images-bucket
SPACES_ACCESS_KEY=your-access-key
SPACES_SECRET_KEY=your-secret-key
SPACES_REGION=nyc3

# Server
PORT=3001
NODE_ENV=development
```

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/users` | Get all form submissions |
| `GET` | `/api/users/:id` | Get specific submission |
| `POST` | `/api/submit` | Submit form with image |

### **API Response Format**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "image_url": "https://bucket.nyc3.cdn.digitaloceanspaces.com/images/uuid.jpg",
      "created_at": "2025-01-01T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

## 🧪 Testing

### **Test API Locally**
```bash
cd backend
node test-api.js
```

### **Test Form Submission**
```bash
curl -X POST http://localhost:3001/api/submit \
  -F "first_name=John" \
  -F "last_name=Doe" \
  -F "image=@test-image.jpg"
```

### **Test Production Health**
```bash
curl https://your-app.ondigitalocean.app/api/health
```

## 💰 Cost Breakdown

| Service | Monthly Cost | Included |
|---------|-------------|----------|
| **App Platform** | $12 | Web hosting, auto-deployment |
| **Spaces** | $5 | 250GB storage, 1TB bandwidth |
| **Total** | **$17/month** | Professional setup |

## 🔒 Security Features

- ✅ **File Type Validation** - Only images allowed
- ✅ **File Size Limits** - 10MB maximum
- ✅ **SQL Injection Protection** - Prepared statements
- ✅ **CORS Configuration** - Controlled cross-origin access
- ✅ **Environment Variables** - Sensitive data protection

## 🎯 Next Steps

### **Phase 2: Advanced Features**
- [ ] Add pull webhook integration for Electron apps
- [ ] Implement image gallery view
- [ ] Add user authentication
- [ ] Set up automated backups
- [ ] Add rate limiting

### **Scaling Options**
- [ ] Migrate to PostgreSQL for higher concurrency
- [ ] Add Redis for session management
- [ ] Implement horizontal scaling
- [ ] Add monitoring and logging

## 🆘 Troubleshooting

### **Common Issues**

**Database Error:**
```bash
cd backend
rm -rf database/
npm run init-db
```

**Spaces Upload Failed:**
- Check API keys in `.env`
- Verify bucket name and region
- Ensure bucket permissions allow public read

**React Not Loading:**
```bash
cd react-app
npm run build
cp -r build ../backend/
```

**CORS Errors:**
- Check `FRONTEND_URL` in backend `.env`
- Verify API calls use correct base URL

## 📋 Useful Commands

```bash
# Development
npm run dev           # Start backend in development
npm start            # Start React dev server

# Production
npm run build-react  # Build React for production
npm run init-db      # Initialize database
npm start           # Start production server

# Testing
node test-api.js     # Test API endpoints
npm run test-local   # Test unified server locally
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 💡 Support

For issues and questions:
1. Check the troubleshooting section
2. Review Digital Ocean documentation
3. Open an issue on GitHub

---

**Built with ❤️ for modern web development**