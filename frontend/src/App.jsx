import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import UploadResume from "./pages/UploadResume";
import AnalyzeResume from "./pages/AnalyzeResume";
import JobMatch from "./pages/JobMatch";
import ProjectInterrogator from "./pages/ProjectInterrogator";
import ResumeBuilder from "./pages/ResumeBuilder";
import MockInterview from "./pages/MockInterview";
import ReadinessDashboard from "./pages/ReadinessDashboard";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";

function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main className="page-enter">{children}</main>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        theme="dark"
      />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
        } />
        <Route path="/upload" element={
          <ProtectedRoute><Layout><UploadResume /></Layout></ProtectedRoute>
        } />
        <Route path="/analyze" element={
          <ProtectedRoute><Layout><AnalyzeResume /></Layout></ProtectedRoute>
        } />
        <Route path="/job-match" element={
          <ProtectedRoute><Layout><JobMatch /></Layout></ProtectedRoute>
        } />
        <Route path="/interrogate" element={
          <ProtectedRoute><Layout><ProjectInterrogator /></Layout></ProtectedRoute>
        } />
        <Route path="/builder" element={
          <ProtectedRoute><Layout><ResumeBuilder /></Layout></ProtectedRoute>
        } />
        <Route path="/mock-interview" element={
          <ProtectedRoute><Layout><MockInterview /></Layout></ProtectedRoute>
        } />
        <Route path="/readiness" element={
          <ProtectedRoute><Layout><ReadinessDashboard /></Layout></ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;