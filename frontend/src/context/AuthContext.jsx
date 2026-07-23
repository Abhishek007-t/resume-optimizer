import { createContext, useContext, useState, useEffect } from "react";
import { getToken, setToken, setUser as saveUser, getUser, clearAuth } from "../utils/storage";
import { loginUser, registerUser, getProfile } from "../services/authService";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getUser());
  const [loading, setLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      const token = getToken();
      if (!token) {
        // `user` state was seeded from localStorage above for optimistic
        // UI — if there's no token to back it up (stale/cleared/tampered
        // localStorage), that seed must not be trusted. Without this,
        // isAuthenticated stays true on a leftover `user` blob alone and
        // ProtectedRoute lets the page shell render before any API call
        // gets the chance to 401 it back out.
        clearAuth();
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const data = await getProfile();
        const userData = data.user;
        setUser(userData);
        saveUser(userData);
      } catch {
        clearAuth();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, []);

  const login = async (credentials) => {
    const data = await loginUser(credentials);
    setToken(data.token);
    setUser(data.user);
    saveUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const data = await registerUser(userData);
    return data;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    // Requires both, not just `user` truthiness — a leftover user blob in
    // localStorage with no backing token must never count as authenticated.
    isAuthenticated: !!user && !!getToken(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };