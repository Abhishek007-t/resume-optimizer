import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { resetPassword } from "../services/authService";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.warning("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.warning("Passwords don't match"); return; }

    try {
      setLoading(true);
      await resetPassword(token, newPassword);
      toast.success("Password reset — log in with your new password");
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.message || "This reset link is invalid or has expired");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
      <div className="relative w-full max-w-md glass-card p-8 animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Reset Password</h1>
          <p className="text-text-secondary text-sm">Choose a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-2 text-sm font-medium text-text-secondary">New Password</label>
            <input
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded-xl bg-bg-card border border-border px-4 py-3 text-text-primary placeholder-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-text-secondary">Confirm New Password</label>
            <input
              type="password"
              placeholder="Re-enter the new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                Resetting...
              </span>
            ) : "Reset Password"}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          <Link to="/" className="font-semibold text-primary hover:text-primary-hover">
            ← Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;
