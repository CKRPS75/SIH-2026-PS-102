import { useState } from "react";
import { signIn } from "../data/auth";

// ── Sign In Screen ─────────────────────────────────────────────────────────────

interface SignInScreenProps {
  onSignedIn: () => void;
}

export function SignInScreen({ onSignedIn }: SignInScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError("Please enter your official email or Officer ID."); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters."); return; }
    setLoading(true);
    setTimeout(() => {
      const ok = signIn(email.trim(), password);
      if (ok) {
        onSignedIn();
      } else {
        setError("Invalid credentials. Please try again.");
      }
      setLoading(false);
    }, 900);
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: "#F3F0F9" }}>
      {/* Header */}
      <div className="px-6 pt-14 pb-6 text-center">
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center text-2xl font-black text-white mx-auto mb-4 shadow-lg"
          style={{ background: "#4F46E5" }}
        >
          GO
        </div>
        <div className="text-xs font-medium tracking-widest uppercase mb-1" style={{ color: "#79747E" }}>
          MPLADS AI-GUARDIAN
        </div>
        <div
          className="text-2xl font-semibold"
          style={{ fontFamily: "'Google Sans Display', sans-serif", color: "#1C1B1F" }}
        >
          Welcome Back
        </div>
        <div className="text-sm mt-1" style={{ color: "#49454F" }}>
          Sign in to your Government Officer account
        </div>
      </div>

      {/* Form Card */}
      <div className="px-4 space-y-3">
        <div className="rounded-3xl p-5 space-y-4" style={{ background: "#FFFBFE" }}>
          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "#49454F" }}>
              Official Email / Officer ID
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="gov.officer@mplads.gov.in"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={{
                background: "#F3F0F9",
                border: "1px solid #CAC4D0",
                color: "#1C1B1F",
                fontFamily: "'Roboto', sans-serif",
              }}
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "#49454F" }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none pr-12"
                style={{
                  background: "#F3F0F9",
                  border: "1px solid #CAC4D0",
                  color: "#1C1B1F",
                  fontFamily: "'Roboto', sans-serif",
                }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full"
                style={{ color: "#79747E" }}
              >
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember Me + Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className="w-5 h-5 rounded flex items-center justify-center"
                onClick={() => setRemember((v) => !v)}
                style={{
                  background: remember ? "#4F46E5" : "transparent",
                  border: remember ? "none" : "2px solid #79747E",
                }}
              >
                {remember && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </div>
              <span className="text-xs" style={{ color: "#49454F" }}>Remember me</span>
            </label>
            <button type="button" className="text-xs font-medium" style={{ color: "#4F46E5" }}>
              Forgot Password?
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl px-4 py-3 text-xs font-medium" style={{ background: "#FFDAD6", color: "#B3261E" }}>
              {error}
            </div>
          )}
        </div>

        {/* Sign In Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full h-14 rounded-3xl text-sm font-semibold text-white md-ripple"
          style={{ background: loading ? "#C5C0FF" : "#4F46E5" }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>

        {/* Info */}
        <div className="text-center pb-6">
          <span className="text-[10px]" style={{ color: "#79747E" }}>
            Authorized Government Officers only · MPLADS AI-Guardian v2.0
          </span>
        </div>
      </div>
    </div>
  );
}

