# Resume Optimizer - Architecture Document

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Components: Auth, Upload, Analysis, JobMatcher, etc  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/REST API
┌────────────────────────▼────────────────────────────────────┐
│              BACKEND (Node.js + Express)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Routes: /auth, /resume, /analyze, /job-match        │   │
│  │ Middleware: JWT Auth, File Upload, Error Handling   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────┬──────────────────────────┬────────────────────┘
             │                          │
    ┌────────▼──────────┐    ┌──────────▼──────────┐
    │  MongoDB Atlas    │    │  Google Gemini API  │
    │  (Database)       │    │  (AI Analysis)      │
    │                   │    │                     │
    │ - Users           │    │ - Resume Analysis   │
    │ - Resumes         │    │ - Job Matching      │
    │ - Analyses        │    │ - Suggestions       │
    └───────────────────┘    └─────────────────────┘
```

---

## 📁 Folder Structure

```
resume-optimizer/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Signup.jsx
│   │   │   ├── Resume/
│   │   │   │   ├── ResumeUpload.jsx
│   │   │   │   ├── ResumeParse.jsx
│   │   │   │   └── ResumePreview.jsx
│   │   │   ├── Analysis/
│   │   │   │   ├── AnalysisResult.jsx
│   │   │   │   └── SuggestionCard.jsx
│   │   │   ├── JobMatcher/
│   │   │   │   └── JobMatchForm.jsx
│   │   │   ├── Dashboard/
│   │   │   │   └── Dashboard.jsx
│   │   │   └── Navbar.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Upload.jsx
│   │   │   ├── Results.jsx
│   │   │   └── Settings.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   └── useResume.js
│   │   ├── utils/
│   │   │   ├── api.js (axios instance)
│   │   │   └── validators.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── config/
│   │   └── db.js (MongoDB connection)
│   ├── models/
│   │   ├── User.js
│   │   ├── Resume.js
│   │   └── Analysis.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── resume.js
│   │   ├── analysis.js
│   │   └── jobMatch.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── resumeController.js
│   │   ├── analysisController.js
│   │   └── jobMatchController.js
│   ├── middleware/
│   │   ├── auth.js (JWT verification)
│   │   ├── upload.js (Multer config)
│   │   └── errorHandler.js
│   ├── services/
│   │   ├── geminiService.js (AI API calls)
│   │   ├── pdfParser.js (Resume parsing)
│   │   └── resumeAnalyzer.js
│   ├── uploads/ (temp file storage)
│   ├── .env
│   ├── server.js
│   └── package.json
│
└── README.md
```

---

## 🗄️ Database Schema (MongoDB)

### **Collection: users**
```javascript
{
  _id: ObjectId,
  email: String (unique),
  password: String (hashed),
  name: String,
  createdAt: Date,
  updatedAt: Date
}
```

### **Collection: resumes**
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: users),
  fileName: String,
  fileUrl: String,
  parsedText: String,
  
  // Extracted sections
  contactInfo: {
    name: String,
    email: String,
    phone: String,
    location: String
  },
  
  summary: String,
  
  experience: [{
    company: String,
    position: String,
    duration: String,
    description: String
  }],
  
  skills: [String],
  
  education: [{
    school: String,
    degree: String,
    field: String,
    year: String
  }],
  
  certifications: [String],
  
  uploadedAt: Date,
  version: Number
}
```

### **Collection: analyses**
```javascript
{
  _id: ObjectId,
  resumeId: ObjectId (ref: resumes),
  userId: ObjectId (ref: users),
  
  // AI-generated analysis
  atsScore: Number (0-100),
  
  strengths: [String],
  
  improvements: [{
    section: String,
    suggestion: String,
    priority: String (high/medium/low)
  }],
  
  missingElements: [String],
  
  keywords: {
    present: [String],
    suggested: [String]
  },
  
  detailedFeedback: String,
  
  createdAt: Date
}
```

### **Collection: jobMatches**
```javascript
{
  _id: ObjectId,
  resumeId: ObjectId (ref: resumes),
  userId: ObjectId (ref: users),
  
  jobDescription: String,
  jobTitle: String,
  company: String,
  
  matchScore: Number (0-100),
  
  matchedSkills: [String],
  missingSkills: [String],
  
  recommendations: [String],
  
  createdAt: Date
}
```

---

## 🔌 API Endpoints

### **Authentication**
```
POST   /api/auth/signup          - Register user
POST   /api/auth/login           - Login user
POST   /api/auth/logout          - Logout
GET    /api/auth/profile         - Get user profile
POST   /api/auth/refresh-token   - Refresh JWT
```

### **Resume Management**
```
POST   /api/resume/upload        - Upload resume (file)
GET    /api/resume/list          - Get all user resumes
GET    /api/resume/:id           - Get specific resume
DELETE /api/resume/:id           - Delete resume
PUT    /api/resume/:id           - Update resume
```

### **Analysis (AI)**
```
POST   /api/analysis/analyze     - Analyze resume (calls Gemini)
GET    /api/analysis/:resumeId   - Get analysis result
```

### **Job Matching**
```
POST   /api/job-match/compare    - Compare resume with job (calls Gemini)
GET    /api/job-match/history    - Get match history
```

---

## 🔐 Authentication Flow

```
User Signup
    ↓
Hash password → Save user to DB
    ↓
Generate JWT token
    ↓
Send token to frontend (httpOnly cookie)
    ↓
User logged in ✓

On Protected Routes:
    ↓
Check JWT in Authorization header
    ↓
Verify token & extract userId
    ↓
Allow access if valid
```

---

## 🤖 AI Integration (Gemini API)

### **Resume Analysis Prompt**
```
Analyze this resume and provide JSON response:
{
  "atsScore": number (0-100),
  "strengths": [strings],
  "improvements": [
    {
      "section": "string",
      "suggestion": "string",
      "priority": "high|medium|low"
    }
  ],
  "missingElements": [strings],
  "keywords": {
    "present": [strings],
    "suggested": [strings]
  },
  "detailedFeedback": "string"
}

Resume: [PARSED RESUME TEXT]
```

### **Job Matching Prompt**
```
Compare resume with job description and provide JSON:
{
  "matchScore": number (0-100),
  "matchedSkills": [strings],
  "missingSkills": [strings],
  "recommendations": [strings]
}

Resume: [RESUME TEXT]
Job Description: [JOB DESC]
```

---

## 📦 Dependencies

### **Frontend**
- react 18
- react-router-dom
- axios
- tailwindcss
- react-icons
- pdfjs-dist (for PDF preview)

### **Backend**
- express
- mongoose (MongoDB)
- jsonwebtoken (JWT)
- bcryptjs (password hashing)
- multer (file upload)
- dotenv (environment vars)
- cors
- axios (for Gemini API calls)
- pdfjs-dist (PDF parsing)
- docx (DOCX parsing)

---

## 🚀 Deployment

### **Frontend (Vercel)**
- Connect GitHub repo
- Auto-deploy on push to main
- Environment: VITE_API_URL = backend URL

### **Backend (Render/Heroku)**
- Push code to GitHub
- Connect Render/Heroku
- Set environment variables:
  - MONGODB_URI
  - JWT_SECRET
  - GEMINI_API_KEY

---

## ⚡ Performance Considerations
- Cache resume parsing results
- Limit AI calls to 1 analysis per resume per day
- Use lazy loading for components
- Optimize PDF parsing
- Database indexing on userId

---

## 🔒 Security Checklist
- ✅ Hash passwords (bcryptjs)
- ✅ Use JWT for authentication
- ✅ Validate all inputs
- ✅ Rate limit API endpoints
- ✅ Secure file uploads (validate type, size)
- ✅ Use environment variables for secrets
- ✅ CORS enabled for frontend only
