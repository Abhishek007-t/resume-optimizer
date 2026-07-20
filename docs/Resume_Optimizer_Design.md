# Resume Optimizer - Design System

## 🎨 Color Palette

### **Primary Colors**
```
Primary Blue: #3B82F6
  - Used for: Buttons, links, highlights
  - Hover: #2563EB (darker)
  - Light: #DBEAFE (background)

Secondary Purple: #8B5CF6
  - Used for: Accents, secondary CTAs
  - Hover: #7C3AED
  - Light: #EDE9FE

Success Green: #10B981
  - Used for: Success messages, high scores
  - Light: #D1FAE5

Warning Orange: #F59E0B
  - Used for: Warnings, medium priority
  - Light: #FEF3C7

Error Red: #EF4444
  - Used for: Errors, delete actions
  - Light: #FEE2E2

Neutral Gray: #6B7280
  - Used for: Text, borders, dividers
  - Light: #F3F4F6
  - Dark: #1F2937
```

### **Tailwind CSS Color Classes**
```css
/* Primary */
bg-blue-500, text-blue-600, border-blue-300

/* Success */
bg-green-500, text-green-600

/* Warning */
bg-yellow-500, text-yellow-600

/* Error */
bg-red-500, text-red-600

/* Gray */
bg-gray-100, text-gray-700, border-gray-300
```

---

## 🔤 Typography

### **Font Family**
```css
/* Use system font stack for performance */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Headings: Bold weight */
/* Body: Regular weight */
/* Captions: Light weight */
```

### **Font Sizes**
```
H1: 32px / 2rem (Page titles)
H2: 24px / 1.5rem (Section headings)
H3: 20px / 1.25rem (Component headings)
H4: 18px / 1.125rem (Small headings)

Body: 16px / 1rem (Default text)
Small: 14px / 0.875rem (Secondary text)
Extra Small: 12px / 0.75rem (Captions, labels)
```

### **Tailwind Classes**
```jsx
<h1 className="text-3xl font-bold">Page Title</h1>
<h2 className="text-2xl font-semibold">Section Title</h2>
<p className="text-base">Body text</p>
<p className="text-sm text-gray-600">Secondary text</p>
```

---

## 📐 Spacing System

```
xs: 4px    (0.25rem)
sm: 8px    (0.5rem)
md: 16px   (1rem)
lg: 24px   (1.5rem)
xl: 32px   (2rem)
2xl: 48px  (3rem)
```

### **Usage**
```jsx
/* Padding */
<div className="p-md">Content</div>
<div className="px-lg py-md">Content</div>

/* Margin */
<div className="m-md mb-xl">Content</div>
<div className="mx-auto">Centered</div>

/* Gap (Flex/Grid) */
<div className="flex gap-md">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

---

## 🎯 Component Style Guide

### **1. Buttons**

#### **Primary Button (Main CTA)**
```jsx
<button className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition">
  Upload Resume
</button>

/* Tailwind: bg-blue-500 hover:bg-blue-600 text-white */
```

#### **Secondary Button**
```jsx
<button className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300">
  Cancel
</button>

/* Tailwind: bg-gray-200 hover:bg-gray-300 text-gray-800 */
```

#### **Danger Button**
```jsx
<button className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600">
  Delete Resume
</button>

/* Tailwind: bg-red-500 hover:bg-red-600 */
```

#### **Button States**
```jsx
/* Disabled */
<button disabled className="opacity-50 cursor-not-allowed">
  Loading...
</button>

/* Loading */
<button className="flex items-center gap-2">
  <Spinner />
  Analyzing...
</button>
```

---

### **2. Cards**

```jsx
<div className="bg-white border border-gray-300 rounded-lg p-lg shadow-sm hover:shadow-md transition">
  <h3 className="text-lg font-semibold mb-md">Resume Title</h3>
  <p className="text-gray-600 mb-lg">Uploaded on Dec 15, 2024</p>
  
  <div className="flex gap-md">
    <button className="text-blue-500 hover:text-blue-600">View</button>
    <button className="text-red-500 hover:text-red-600">Delete</button>
  </div>
</div>

/* Tailwind: bg-white border border-gray-200 rounded-lg p-6 shadow-sm */
```

---

### **3. Form Input Fields**

```jsx
<div className="mb-lg">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Email Address
  </label>
  <input
    type="email"
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    placeholder="your@email.com"
  />
</div>

/* Error State */
<input
  type="email"
  className="w-full px-4 py-2 border border-red-500 rounded-lg"
/>
<p className="text-red-500 text-sm mt-1">Email is invalid</p>

/* Success State */
<input
  type="email"
  className="w-full px-4 py-2 border border-green-500 rounded-lg"
/>
```

---

### **4. Score Display Cards**

```jsx
<div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 rounded-lg p-lg">
  <p className="text-sm text-blue-600 font-medium">ATS Score</p>
  
  <div className="flex items-center gap-md mt-md">
    <div className="text-4xl font-bold text-blue-600">82</div>
    
    {/* Visual bar */}
    <div className="flex-1 bg-gray-300 rounded-full h-3">
      <div 
        className="bg-green-500 h-3 rounded-full"
        style={{ width: '82%' }}
      ></div>
    </div>
  </div>
</div>

/* Score color logic */
if (score >= 80) className = "text-green-600"; // Good
if (score >= 60 && score < 80) className = "text-yellow-600"; // OK
if (score < 60) className = "text-red-600"; // Needs work
```

---

### **5. Alert Messages**

```jsx
/* Success */
<div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-lg">
  ✓ Resume uploaded successfully!
</div>

/* Error */
<div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
  ✗ Upload failed. Please try again.
</div>

/* Warning */
<div className="bg-yellow-50 border border-yellow-300 text-yellow-700 px-4 py-3 rounded-lg">
  ⚠ This resume has low ATS score.
</div>

/* Info */
<div className="bg-blue-50 border border-blue-300 text-blue-700 px-4 py-3 rounded-lg">
  ℹ Analyzing your resume...
</div>
```

---

### **6. Loading States**

```jsx
/* Skeleton Loading */
<div className="space-y-4">
  <div className="h-4 bg-gray-300 rounded w-3/4 animate-pulse"></div>
  <div className="h-4 bg-gray-300 rounded w-1/2 animate-pulse"></div>
  <div className="h-4 bg-gray-300 rounded w-4/5 animate-pulse"></div>
</div>

/* Spinner */
<div className="flex justify-center items-center">
  <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
</div>

/* Loading Text */
<p className="text-gray-600 flex items-center gap-2">
  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
  Analyzing resume...
</p>
```

---

## 📱 Responsive Design

### **Breakpoints**
```
Mobile:  < 640px   (sm)
Tablet:  640-1024px (md)
Desktop: > 1024px  (lg)
```

### **Mobile-First Approach**
```jsx
/* Mobile first, then tablet/desktop */
<div className="flex flex-col md:flex-row gap-4">
  <div className="w-full md:w-1/3">Sidebar</div>
  <div className="w-full md:w-2/3">Content</div>
</div>

/* Text sizes responsive */
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Title
</h1>
```

---

## 🔄 Transitions & Animations

### **Hover Effects**
```jsx
/* Smooth transitions */
<button className="bg-blue-500 hover:bg-blue-600 transition">
  Button
</button>

/* Duration control */
<div className="hover:shadow-lg transition-shadow duration-300">
  Card
</div>

/* Transform */
<button className="hover:scale-105 transition transform">
  Button
</button>
```

### **Animations**
```jsx
/* Fade in */
<div className="animate-fade-in">Content</div>

/* Slide in */
<div className="animate-slide-in">Content</div>

/* Pulse */
<div className="animate-pulse">Loading...</div>
```

**Add to tailwind.config.js**:
```js
theme: {
  extend: {
    keyframes: {
      fadeIn: {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
      slideIn: {
        '0%': { transform: 'translateX(-10px)', opacity: '0' },
        '100%': { transform: 'translateX(0)', opacity: '1' },
      },
    },
    animation: {
      fadeIn: 'fadeIn 0.3s ease-in-out',
      slideIn: 'slideIn 0.3s ease-in-out',
    },
  },
},
```

---

## 🎨 Layout Patterns

### **Page Layout (Standard)**
```jsx
<div className="min-h-screen bg-gray-50">
  {/* Navbar */}
  <nav className="bg-white shadow-sm">
    {/* Nav content */}
  </nav>
  
  {/* Main content */}
  <main className="max-w-7xl mx-auto px-4 py-8">
    <div className="grid grid-cols-12 gap-8">
      {/* Sidebar (optional) */}
      <aside className="col-span-3">Sidebar</aside>
      
      {/* Main content */}
      <div className="col-span-9">Content</div>
    </div>
  </main>
  
  {/* Footer (optional) */}
  <footer className="bg-gray-800 text-white mt-16">
    Footer
  </footer>
</div>
```

### **Card Grid**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {resumes.map(resume => (
    <div key={resume._id} className="bg-white rounded-lg p-6 shadow-sm">
      {/* Card content */}
    </div>
  ))}
</div>
```

---

## ✅ Design Checklist

- [ ] All colors match palette
- [ ] Font sizes consistent
- [ ] Spacing follows grid
- [ ] Buttons have hover states
- [ ] Forms have error/success states
- [ ] Loading states visible
- [ ] Mobile responsive
- [ ] Touch targets min 44x44px
- [ ] Color contrast accessible (AA)
- [ ] No janky transitions

---

## 🎯 UI Patterns for Key Pages

### **Upload Page**
- Large file input with drag-drop
- File preview before upload
- Upload progress bar
- Success/error messaging

### **Analysis Results**
- Large score display (visual)
- Strengths section (green)
- Improvements section (organized by priority)
- Keywords section
- Download button

### **Dashboard**
- Search/filter resumes
- Resume cards in grid
- Quick action buttons
- Sorting options
- Pagination if many resumes

### **Job Matcher**
- Resume selector
- Large textarea for job description
- Submit button
- Loading state during matching
- Results with match score visual
- Matched vs missing skills comparison
