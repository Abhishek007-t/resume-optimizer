import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? "text-primary bg-primary/10 shadow-sm"
        : "text-text-secondary hover:text-text-primary hover:bg-white/5"
    }`;

  return (
    <header className="sticky top-0 z-50 bg-bg-dark/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl font-bold gradient-text">Resume Optimizer</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
            <NavLink to="/upload" className={linkClass}>Upload</NavLink>
            <NavLink to="/analyze" className={linkClass}>Analyze</NavLink>
            <NavLink to="/job-match" className={linkClass}>Job Match</NavLink>
            <NavLink to="/interrogate" className={linkClass}>Interrogator</NavLink>
            <NavLink to="/builder" className={linkClass}>Builder</NavLink>
            <NavLink to="/mock-interview" className={linkClass}>Mock Interview</NavLink>
            <NavLink to="/readiness" className={linkClass}>Readiness</NavLink>
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <span className="text-sm text-text-secondary">
                Hi, <span className="text-primary font-medium">{user.name}</span>
              </span>
            )}
            <button
              onClick={logout}
              className="px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 rounded-lg transition"
            >
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-border mt-2 pt-3 animate-fade-in">
            <nav className="flex flex-col gap-1">
              <NavLink to="/dashboard" className={linkClass} onClick={() => setMobileOpen(false)}>Dashboard</NavLink>
              <NavLink to="/upload" className={linkClass} onClick={() => setMobileOpen(false)}>Upload</NavLink>
              <NavLink to="/analyze" className={linkClass} onClick={() => setMobileOpen(false)}>Analyze</NavLink>
              <NavLink to="/job-match" className={linkClass} onClick={() => setMobileOpen(false)}>Job Match</NavLink>
              <NavLink to="/interrogate" className={linkClass} onClick={() => setMobileOpen(false)}>Interrogator</NavLink>
              <NavLink to="/builder" className={linkClass} onClick={() => setMobileOpen(false)}>Builder</NavLink>
              <NavLink to="/mock-interview" className={linkClass} onClick={() => setMobileOpen(false)}>Mock Interview</NavLink>
              <NavLink to="/readiness" className={linkClass} onClick={() => setMobileOpen(false)}>Readiness</NavLink>
              <hr className="border-border my-2" />
              {user && <span className="text-sm text-text-secondary px-3">Hi, {user.name}</span>}
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="text-left px-3 py-2 text-sm text-danger hover:bg-danger/10 rounded-lg transition"
              >
                Logout
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
