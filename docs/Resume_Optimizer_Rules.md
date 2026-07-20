# Resume Optimizer - Rules & Guidelines

## 🤖 AI Usage Rules (SAVE YOUR FREE CREDITS!)

### **WHEN TO USE GEMINI API (Critical Only)**
✅ **DO USE** - Analyzing resume for improvements
✅ **DO USE** - Comparing resume with job description
✅ **DO USE** - Generating improvement suggestions

### **WHEN TO NOT USE GEMINI API (Manual/Code)**
❌ **DON'T USE** - Resume text parsing (use pdfjs instead)
❌ **DON'T USE** - Extracting contact info (regex)
❌ **DON'T USE** - Formatting dates/text (JavaScript)
❌ **DON'T USE** - Basic validation (manual code)

---

## 💡 Smart API Usage Strategy

### **Current Gemini Free Tier**
- 30 requests per minute
- 1,500 requests per day
- **For this project**: More than enough!

### **Cost Optimization**
```
Example Usage:
- 10 users × 3 analyses/month = 30 analyses/month
- 30 requests/month = 0.02% of free quota ✓
- Cost: $0 forever ✓
```

### **Caching Strategy**
- **Cache** resume analysis results (don't re-analyze same resume)
- **Cache** job descriptions (don't re-match same job)
- **Cache** improvement suggestions

---

## 📝 Code Standards

### **JavaScript/Node.js**
```javascript
// ✅ DO: Use meaningful variable names
const resumeAnalysisResult = { atsScore: 85 };

// ❌ DON'T: Single letter variables
const x = { atsScore: 85 };

// ✅ DO: Use async/await
const analyzeResume = async (resumeText) => {
  const result = await geminiService.analyze(resumeText);
  return result;
};

// ❌ DON'T: Use callbacks (outdated)
geminiService.analyze(resumeText, (err, result) => {});

// ✅ DO: Use try/catch
try {
  const analysis = await analyzeResume(text);
} catch (error) {
  logger.error('Analysis failed:', error.message);
  res.status(500).json({ error: 'Analysis failed' });
}

// ✅ DO: Validate inputs
if (!resumeText || resumeText.trim().length === 0) {
  throw new Error('Resume text cannot be empty');
}
```

### **React Components**
```jsx
// ✅ DO: Use functional components with hooks
const ResumeUpload = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  
  return <div>{/* JSX */}</div>;
};

// ✅ DO: Use custom hooks for logic
const useResumeUpload = () => {
  const [file, setFile] = useState(null);
  // logic here
  return { file, setFile };
};

// ❌ DON'T: Use class components (outdated for learning)
class ResumeUpload extends React.Component {}

// ✅ DO: Handle errors
const handleUpload = async (file) => {
  try {
    const response = await uploadResume(file);
    setUploadSuccess(true);
  } catch (error) {
    setError(error.message);
  }
};
```

### **API Responses**
```javascript
// ✅ DO: Consistent response format
res.json({
  success: true,
  data: { /* actual data */ },
  message: 'Operation successful'
});

// On error:
res.status(400).json({
  success: false,
  error: 'Specific error message',
  code: 'ERROR_CODE'
});

// ✅ DO: Include metadata
res.json({
  success: true,
  data: resumes,
  total: 10,
  page: 1,
  limit: 5
});
```

---

## 🛠️ Libraries to Use

### **MUST USE**
- `express` - Server framework
- `mongoose` - MongoDB ORM
- `jsonwebtoken` - JWT auth
- `bcryptjs` - Password hashing
- `multer` - File upload
- `axios` - HTTP requests
- `pdfjs-dist` - PDF parsing
- `dotenv` - Environment variables

### **SHOULD USE**
- `cors` - CORS handling
- `helmet` - Security headers
- `express-validator` - Input validation
- `morgan` - Request logging
- `tailwindcss` - Styling (React)
- `react-router-dom` - Routing (React)

### **AVOID**
- ❌ `jQuery` - Outdated
- ❌ `request` library - Deprecated (use axios)
- ❌ `moment.js` - Use native Date
- ❌ Global variables
- ❌ `var` keyword (use `const`/`let`)

---

## ✅ Error Handling

### **Backend Error Handling**
```javascript
// Create centralized error handler
const handleError = (error) => {
  if (error.name === 'ValidationError') {
    return { status: 400, message: 'Validation failed' };
  }
  if (error.name === 'UnauthorizedError') {
    return { status: 401, message: 'Not authenticated' };
  }
  return { status: 500, message: 'Server error' };
};

// Use in routes
app.post('/api/analyze', async (req, res) => {
  try {
    // logic
  } catch (error) {
    const { status, message } = handleError(error);
    res.status(status).json({ success: false, error: message });
  }
});
```

### **Frontend Error Handling**
```jsx
// Display errors to user
const [error, setError] = useState(null);

const uploadResume = async (file) => {
  try {
    const response = await api.post('/resume/upload', { file });
    setSuccessMessage('Resume uploaded!');
  } catch (error) {
    setError(error.response?.data?.error || 'Upload failed');
  }
};

return (
  <>
    {error && <ErrorAlert message={error} />}
  </>
);
```

---

## 🔐 Security Rules

### **Password Security**
```javascript
// ✅ DO: Hash passwords
const salt = await bcryptjs.genSalt(10);
const hashedPassword = await bcryptjs.hash(password, salt);

// ❌ DON'T: Store plain text passwords
user.password = password; // WRONG!
```

### **JWT Security**
```javascript
// ✅ DO: Use httpOnly cookies
res.cookie('token', jwtToken, {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

// ✅ DO: Verify token on protected routes
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};
```

### **File Upload Security**
```javascript
// ✅ DO: Validate file type
const allowedTypes = ['application/pdf', 'text/plain'];
if (!allowedTypes.includes(file.mimetype)) {
  throw new Error('Invalid file type');
}

// ✅ DO: Limit file size
if (file.size > 5 * 1024 * 1024) { // 5MB
  throw new Error('File too large');
}

// ✅ DO: Rename files
const newFileName = `${userId}_${Date.now()}_${file.originalname}`;
```

### **Input Validation**
```javascript
// ✅ DO: Validate all inputs
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// ✅ DO: Sanitize inputs
const sanitizeText = (text) => {
  return text.trim().replace(/[<>]/g, '');
};
```

---

## 📊 Database Rules

### **Indexing**
```javascript
// ✅ DO: Index frequently queried fields
resumeSchema.index({ userId: 1 });
resumeSchema.index({ uploadedAt: -1 });
userSchema.index({ email: 1 }, { unique: true });
```

### **Query Optimization**
```javascript
// ✅ DO: Select only needed fields
const resumes = await Resume.find({ userId }).select('_id fileName atsScore');

// ✅ DO: Limit results
const resumes = await Resume.find({ userId }).limit(10);

// ❌ DON'T: Fetch all data
const allResumes = await Resume.find({}); // No limit!
```

---

## 📝 Naming Conventions

### **Variables**
```javascript
✅ const userEmail = 'user@email.com';
✅ const isLoading = true;
✅ const resumeAnalysis = { score: 85 };
❌ const e = 'user@email.com';
❌ const UEmail = 'user@email.com';
```

### **Functions**
```javascript
✅ const analyzeResume = () => {};
✅ const getUserResumes = () => {};
✅ const uploadFile = () => {};
❌ const analyze() => {}; // No "Resume" context
❌ const get() => {}; // Too generic
```

### **Files**
```
✅ components/ResumeUpload.jsx
✅ routes/resume.js
✅ controllers/resumeController.js
❌ components/upload.jsx (not descriptive)
❌ routes/r.js (too short)
```

---

## 🚀 Git Commit Messages

```
✅ DO:
- "feat: add resume upload functionality"
- "fix: resolve JWT verification error"
- "refactor: optimize resume parsing logic"
- "docs: update API documentation"

❌ DON'T:
- "update"
- "bug fix"
- "changes"
- "asdfgh"
```

---

## 🧪 Testing (Optional but Good to Know)

### **Manual Testing Checklist**
- [ ] Upload PDF, DOCX, TXT files
- [ ] Parse resume correctly
- [ ] API returns proper error messages
- [ ] AI analysis works and returns JSON
- [ ] Job matching works
- [ ] User auth works (login/logout)
- [ ] Database stores data correctly
- [ ] Frontend handles loading states

### **API Testing (Postman)**
```
POST /api/auth/signup
Headers: Content-Type: application/json
Body: { "email": "test@test.com", "password": "123456" }

Response: { "success": true, "token": "jwt..." }
```

---

## 📋 Pre-Deployment Checklist

- [ ] All secrets in `.env` (not in code)
- [ ] Error handling on all endpoints
- [ ] Input validation on all inputs
- [ ] Database indexes created
- [ ] No console.log() statements in production code
- [ ] CORS properly configured
- [ ] JWT secret is strong
- [ ] File upload limits set
- [ ] API rate limiting (optional)
- [ ] README with setup instructions
