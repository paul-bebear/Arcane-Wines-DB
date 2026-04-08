import { useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("signin");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
        setError("Check your email for a confirmation link.");
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="login-wine-icon">🍷</div>
          <div style={{
            fontSize: 28, fontWeight: 700,
            color: "#9B95E8",
            marginBottom: 4,
          }}>
            Arcane Wines
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            {mode === "signin" ? "Sign in to your cellar" : "Create your account"}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="label">Email</label>
          <input
            type="email" required
            className="input"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ marginBottom: 14 }}
          />

          <label className="label">Password</label>
          <input
            type="password" required minLength={6}
            className="input"
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ marginBottom: 20 }}
          />

          {error && (
            <div style={{
              padding: "8px 12px", borderRadius: 10, fontSize: 12,
              background: error.includes("Check your email") ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              color: error.includes("Check your email") ? "#86efac" : "#fca5a5",
              marginBottom: 14,
              border: `1px solid ${error.includes("Check your email") ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: "100%", padding: "12px 0", fontSize: 14,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                <span>{mode === "signin" ? "Signing in..." : "Creating account..."}</span>
              </span>
            ) : (
              mode === "signin" ? "Sign In" : "Sign Up"
            )}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
            style={{
              background: "none", border: "none",
              fontSize: 12, color: "rgba(155,149,232,0.8)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
