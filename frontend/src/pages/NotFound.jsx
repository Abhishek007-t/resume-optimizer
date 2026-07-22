import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-bg-dark via-slate-900 to-purple-950/30 pointer-events-none"></div>

      <div className="relative text-center animate-slide-up">
        <h1 className="text-8xl sm:text-9xl font-bold gradient-text mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-text-primary mb-2">Page Not Found</h2>
        <p className="text-text-secondary mb-8">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link
          to="/dashboard"
          className="inline-block px-8 py-3 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl font-semibold btn-glow transition"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default NotFound;