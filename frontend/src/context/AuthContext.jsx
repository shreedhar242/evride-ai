import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { TOKEN_KEY } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const storedToken = sessionStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return () => { active = false; };
    }

    api.get("/auth/me")
      .then(({ data }) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        sessionStorage.removeItem(TOKEN_KEY);
        if (active) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  async function login(credentials) {
    const { data } = await api.post("/auth/login", credentials);
    sessionStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(details) {
    const { data } = await api.post("/auth/register", details);
    return data.user;
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({ user, token, loading, login, logout, register }), [user, token, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
