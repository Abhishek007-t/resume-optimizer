# Resume Optimizer - Project Phases

## 📅 Timeline Overview
- **Total Duration**: 5-7 weeks
- **Learning Focus**: MERN Stack + API Integration
- **Difficulty**: Intermediate

---

# PHASE 1: Project Setup & Infrastructure
**Duration**: 3-4 days  
**Status**: 🔴 NOT STARTED

## Subtasks

### 1.1 Backend Setup
- [ ] Create Node.js project: `npm init -y`
- [ ] Install dependencies: express, mongoose, jsonwebtoken, bcryptjs, multer, dotenv
- [ ] Create folder structure (config, models, routes, controllers, middleware)
- [ ] Setup `.env` file with dummy values
- [ ] Create `server.js` with basic Express server
- [ ] Test server runs on localhost:5000

**Deliverable**: Server starts without errors

### 1.2 Frontend Setup
- [ ] Create React project: `npm create vite@latest`
- [ ] Install dependencies: react-router-dom, axios, tailwindcss
- [ ] Setup folder structure (components, pages, hooks, utils)
- [ ] Configure Tailwind CSS
- [ ] Create basic App.jsx with routing
- [ ] Test frontend runs on localhost:5173

**Deliverable**: React app loads without errors

### 1.3 Database Setup
- [ ] Create MongoDB Atlas account (free)
- [ ] Create cluster
- [ ] Get connection URI
- [ ] Create User model (mongoose schema)
- [ ] Connect MongoDB to backend
- [ ] Test connection with console.log

**Deliverable**: MongoDB connected and working

### 1.4 Git & Version Control
- [ ] Initialize Git repository
- [ ] Create .gitignore (node_modules, .env, uploads/)
- [ ] Create initial commit
- [ ] Push to GitHub

**Deliverable**: GitHub repo with initial commit

---

# PHASE 2: Authentication System
**Duration**: 4-5 days  
**Status**: 🔴 NOT STARTED  
**Prerequisites**: Phase 1 complete

## Subtasks

### 2.1 Backend Authentication
- [ ] Create User model with fields: email, password, name, createdAt
- [ ] Create /api/auth/signup route
  - Validate email & password
  - Hash password with bcryptjs
  - Save user to database
  - Return JWT token
- [ ] Create /api/auth/login route
  - Find user by email
  - Compare password with bcrypt
  - Generate JWT token
  - Return token
- [ ] Create middleware to verify JWT token
- [ ] Test with Postman

**Code Example**:
```javascript
// POST /api/auth/signup
const signup = async (req, res) => {
  const { email, password, name } = req.body;
  
  // Validate
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  // Hash password
  const salt = await bcryptjs.genSalt(10);
  const hashedPassword = await bcryptjs.hash(password, salt);
  
  // Save user
  const user = new User({ email, password: hashedPassword, name });
  await user.save();
  
  // Generate token
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
  
  res.json({ success: true, token });
};
```

**Deliverable**: Can signup and login via API

### 2.2 Frontend Authentication
- [ ] Create Signup.jsx component
  - Form with email, password, name
  - Call /api/auth/signup
  - Store token in localStorage
- [ ] Create Login.jsx component
  - Form with email, password
  - Call /api/auth/login
  - Store token in localStorage
- [ ] Create useAuth hook
  - Check if user is logged in
  - Get stored token
  - Logout functionality
- [ ] Create ProtectedRoute component
  - Redirect if not logged in
  - Show component if logged in

**Deliverable**: Can signup, login, and navigate to dashboard

### 2.3 User Profile
- [ ] Create GET /api/auth/profile route
- [ ] Create Profile.jsx component
- [ ] Display user information
- [ ] Add logout button

**Deliverable**: Authenticated users can view their profile

---

# PHASE 3: Resume Upload & Parsing
**Duration**: 5-6 days  
**Status**: 🔴 NOT STARTED  
**Prerequisites**: Phase 1-2 complete

## Subtasks

### 3.1 Backend File Upload
- [ ] Setup multer middleware for file uploads
- [ ] Create uploads folder
- [ ] Create POST /api/resume/upload route
  - Accept file (PDF/DOCX/TXT)
  - Validate file type & size
  - Save file to server
  - Save resume record to MongoDB
  - Return resume data
- [ ] Create Resume model with fields: userId, fileName, fileUrl, parsedText, uploadedAt

**Code Example**:
```javascript
// POST /api/resume/upload
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

app.post('/api/resume/upload', authenticateToken, upload.single('resume'), 
  async (req, res) => {
    const resume = new Resume({
      userId: req.userId,
      fileName: req.file.originalname,
      fileUrl: req.file.path
    });
    await resume.save();
    res.json({ success: true, resume });
  }
);
```

**Deliverable**: Can upload files via API

### 3.2 Resume Parsing
- [ ] Install pdfjs-dist for PDF parsing
- [ ] Create pdfParser.js service
  - Read PDF file
  - Extract all text
  - Return extracted text
- [ ] Create POST /api/resume/parse route
  - Read uploaded file
  - Parse text
  - Extract contact info, skills, experience
  - Save parsed data to database
  - Return structured data

**Code Example**:
```javascript
// pdfParser.js
const pdfjs = require('pdfjs-dist');

const parsePDF = async (filePath) => {
  const pdf = await pdfjs.getDocument(filePath).promise;
  let text = '';
  
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ');
  }
  
  return text;
};
```

**Deliverable**: Parsed resume text displayed to user

### 3.3 Frontend Resume Upload
- [ ] Create ResumeUpload.jsx component
  - File input with drag-drop
  - Show loading state while uploading
  - Display file preview
- [ ] Create ResumeParse.jsx component
  - Show parsed resume sections (contact, experience, skills, etc.)
  - Display extracted data in structured format
  - Option to edit extracted data
  - Button to "Continue to Analysis"

**Deliverable**: User can upload and see parsed resume

---

# PHASE 4: AI Resume Analysis
**Duration**: 4-5 days  
**Status**: 🔴 NOT STARTED  
**Prerequisites**: Phase 1-3 complete

## Subtasks

### 4.1 Setup Gemini API
- [ ] Get free Google Gemini API key (ai.google.dev)
- [ ] Add GEMINI_API_KEY to .env
- [ ] Create geminiService.js
  - Function to call Gemini API
  - Error handling
  - Response parsing

**Code Example**:
```javascript
// geminiService.js
const axios = require('axios');

const analyzeResume = async (resumeText) => {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{
        parts: [{
          text: `Analyze this resume and provide JSON response:
{
  "atsScore": number 0-100,
  "strengths": [strings],
  "improvements": [
    {
      "section": "string",
      "suggestion": "string",
      "priority": "high|medium|low"
    }
  ],
  "keywords": {
    "present": [strings],
    "suggested": [strings]
  }
}

Resume: ${resumeText}`
        }]
      }]
    }
  );
  
  const text = response.data.candidates[0].content.parts[0].text;
  return JSON.parse(text);
};
```

**Deliverable**: Can call Gemini API successfully

### 4.2 Backend Analysis Route
- [ ] Create POST /api/analysis/analyze route
  - Get resume text from database
  - Call Gemini API
  - Parse response
  - Save analysis to database
  - Return results
- [ ] Create Analysis model
- [ ] Add error handling for API failures

**Deliverable**: Analysis saved to database

### 4.3 Frontend Analysis Display
- [ ] Create AnalysisResult.jsx component
  - Display ATS score (with visual indicator)
  - Show strengths
  - Show improvements (organized by priority)
  - Show keywords section
  - Display feedback
- [ ] Add loading state while analyzing
- [ ] Add error message if analysis fails
- [ ] Button to download suggestions as PDF (optional)

**Deliverable**: Beautiful results page showing AI analysis

---

# PHASE 5: Job Matching Feature
**Duration**: 3-4 days  
**Status**: 🔴 NOT STARTED  
**Prerequisites**: Phase 1-4 complete

## Subtasks

### 5.1 Backend Job Matching
- [ ] Create POST /api/job-match/compare route
  - Accept resume ID and job description
  - Get resume from database
  - Call Gemini API with both texts
  - Calculate match score
  - Save results
  - Return match data
- [ ] Create JobMatch model

**Code Example**:
```javascript
// POST /api/job-match/compare
const compareWithJob = async (req, res) => {
  const { resumeId, jobDescription } = req.body;
  
  // Get resume
  const resume = await Resume.findById(resumeId);
  if (!resume) return res.status(404).json({ error: 'Resume not found' });
  
  // Call Gemini
  const matchResult = await geminiService.matchJob(
    resume.parsedText,
    jobDescription
  );
  
  // Save match
  const jobMatch = new JobMatch({
    resumeId,
    userId: req.userId,
    jobDescription,
    matchScore: matchResult.matchScore,
    matchedSkills: matchResult.matchedSkills,
    missingSkills: matchResult.missingSkills,
    recommendations: matchResult.recommendations
  });
  await jobMatch.save();
  
  res.json({ success: true, match: jobMatch });
};
```

**Deliverable**: API returns job match scores

### 5.2 Frontend Job Matcher
- [ ] Create JobMatcher.jsx page
  - Select resume dropdown
  - Text area for job description
  - Submit button
- [ ] Create MatchResult.jsx component
  - Display match score (visual indicator)
  - Show matched skills
  - Show missing skills
  - Show recommendations
- [ ] Add loading and error states

**Deliverable**: Users can compare resumes with job descriptions

---

# PHASE 6: Dashboard & Refinement
**Duration**: 3-4 days  
**Status**: 🔴 NOT STARTED  
**Prerequisites**: Phase 1-5 complete

## Subtasks

### 6.1 Dashboard Page
- [ ] Create Dashboard.jsx
  - List all user's resumes
  - Show resume name, ATS score, date uploaded
  - Quick stats (total resumes, avg score)
  - Links to view/edit/delete resumes
  - Button to upload new resume
- [ ] Create GET /api/resume/list route
  - Return all resumes for user
  - Include latest analysis

**Deliverable**: Dashboard shows all user data

### 6.2 Refinements & Polish
- [ ] Add loading skeletons
- [ ] Improve error messages
- [ ] Add success notifications
- [ ] Responsive design for mobile
- [ ] Dark mode (optional)
- [ ] Add animations/transitions

**Deliverable**: Polished UI/UX

### 6.3 Testing
- [ ] Test all features manually
  - Signup/Login
  - Upload resume
  - Parse resume
  - Analyze resume
  - Match with job
  - View dashboard
  - View history
- [ ] Test error scenarios
- [ ] Test on mobile

**Deliverable**: All features working bug-free

---

# PHASE 7: Deployment
**Duration**: 1-2 days  
**Status**: 🔴 NOT STARTED  
**Prerequisites**: Phase 1-6 complete

## Subtasks

### 7.1 Backend Deployment (Render/Heroku)
- [ ] Create Render/Heroku account
- [ ] Push code to GitHub
- [ ] Connect repository
- [ ] Set environment variables
- [ ] Deploy backend
- [ ] Test deployed API

**Deliverable**: Backend live on Render

### 7.2 Frontend Deployment (Vercel)
- [ ] Update API URL to deployed backend
- [ ] Push to GitHub
- [ ] Connect Vercel to repo
- [ ] Deploy frontend
- [ ] Test deployed app

**Deliverable**: Full app live and accessible

### 7.3 Documentation
- [ ] Create README.md
  - Setup instructions
  - Features list
  - Tech stack
  - Screenshots
- [ ] Add comments to code
- [ ] Create API documentation

**Deliverable**: Project fully documented

---

## 🎯 Current Status

```
Phase 1: ⬜ NOT STARTED
Phase 2: ⬜ NOT STARTED
Phase 3: ⬜ NOT STARTED
Phase 4: ⬜ NOT STARTED
Phase 5: ⬜ NOT STARTED
Phase 6: ⬜ NOT STARTED
Phase 7: ⬜ NOT STARTED

Overall: 0% Complete
```

---

## ✅ Completion Checklist
- [ ] All phases completed
- [ ] No bugs found
- [ ] App deployed and live
- [ ] README complete
- [ ] GitHub repo public
- [ ] Portfolio-ready!
