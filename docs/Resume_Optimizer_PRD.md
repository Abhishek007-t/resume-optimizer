# Resume Optimizer - Project Requirements Document

## 📋 Overview
**Project**: AI-Powered Resume Optimizer & Job Matcher  
**Target Users**: Students, Job Seekers, Career Switchers  
**Status**: Learning MERN Stack Project  

---

## 🎯 Problem Statement
- Students don't know how to improve their resumes
- Manual resume review is time-consuming
- Hard to match resume with job requirements
- No easy way to track resume improvements

---

## 👥 Target Users
- College students (primary)
- Fresh graduates
- Career switchers
- Job seekers

---

## ✨ Core Features (MVP)

### **Feature 1: Resume Upload & Parsing**
- Upload resume (PDF/DOCX/TXT)
- Parse resume text automatically
- Extract key sections (experience, skills, education)
- Display parsed data in structured format

### **Feature 2: Resume Analysis (AI)**
- Analyze for grammar/spelling
- Identify missing key sections
- Suggest improvements
- Get ATS score (Applicant Tracking System)
- Find gaps in qualifications

### **Feature 3: Job Match Score**
- Input job description
- Compare with resume
- Generate match percentage
- List missing skills
- Suggest tailored keywords

### **Feature 4: Resume Improvement Suggestions**
- Get AI recommendations
- Before/after comparison
- Track improvements over versions
- Download improved resume

### **Feature 5: User Dashboard**
- View all uploaded resumes
- Track scores/versions
- History of job matches
- Progress tracking

---

## 🚀 Nice-to-Have Features (Phase 2+)
- ✅ Job scraping from LinkedIn/Indeed
- ✅ Keyword extraction
- ✅ Cover letter generator
- ✅ Interview prep questions
- ✅ Template gallery
- ✅ Skills validation

---

## 📊 Success Metrics
- Users can upload & parse resume ✅
- Get AI feedback within 30 seconds ✅
- See improvement score increase ✅
- Match jobs successfully ✅

---

## 💰 Monetization (Optional)
- FREE tier: 5 resume analyses/month
- PAID tier: Unlimited analyses ($2.99/month or $19.99/year)

---

## 🔐 User Flow
1. User signs up with email
2. Upload resume (PDF/DOCX)
3. System parses resume
4. View parsed resume data
5. Click "Analyze" → AI generates feedback
6. View improvement suggestions
7. (Optional) Enter job description → Get match score
8. Download improved resume

---

## 📱 Pages Needed
1. **Authentication Page** (Login/Signup)
2. **Dashboard** (View all resumes)
3. **Resume Upload Page** (Upload, parse, preview)
4. **Analysis Results Page** (AI feedback, suggestions)
5. **Job Matcher Page** (Compare with job description)
6. **Settings Page** (Profile, preferences)

---

## 🛠️ Tech Stack (MERN)
- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: MongoDB (free tier)
- **AI**: Google Gemini API (free tier)
- **PDF Parser**: pdfjs-dist
- **Authentication**: JWT
- **File Upload**: Multer
- **Hosting**: Vercel (frontend) + Render (backend)

---

## 📈 Project Timeline (Estimated)
- Phase 1 (Setup): 1 week
- Phase 2 (Resume Parser): 1-2 weeks
- Phase 3 (AI Analysis): 1-2 weeks
- Phase 4 (Job Matcher): 1 week
- Phase 5 (UI/Polish): 1 week
- **Total**: 5-7 weeks

---

## 🎓 Learning Goals
✅ Build full MERN stack project  
✅ Integrate external APIs (Gemini)  
✅ File upload & parsing  
✅ JWT authentication  
✅ Deploy to production  
✅ Database design  
✅ Error handling  
