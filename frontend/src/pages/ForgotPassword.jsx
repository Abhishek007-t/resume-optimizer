import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { Mail } from "lucide-react";
import { forgotPassword } from "../services/authService";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await forgotPassword(email);
      setSent(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
      <div className="relative w-full max-w-md glass-card p-8 animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Forgot Password</h1>
          <p className="text-text-secondary text-sm">We&apos;ll email you a link to reset it</p>
        </div>

        {sent ? (
          <div className="text-center py-4 animate-fade-in">
            <Mail className="w-12 h-12 mb-4 text-primary mx-auto" />
            <p className="text-text-primary mb-2">If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
            <p className="text-text-secondary text-sm">Check your inbox (and spam folder). The link expires in 1 hour.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block mb-2 text-sm font-medium text-text-secondary">Email</label>
              <input
                type="email"
                placeholder="Enter your account email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl bg-bg-card border border-border px-4 py-3 text-text-primary placeholder-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-hover py-3 text-white font-semibold btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow"></span>
                  Sending...
                </span>
              ) : "Send Reset Link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-text-secondary mt-6">
          <Link to="/" className="font-semibold text-primary hover:text-primary-hover">
            ← Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
