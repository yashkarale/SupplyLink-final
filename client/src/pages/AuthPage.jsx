import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSellerProfile, loginUser, registerUser, resendVerificationEmail, setAuthToken } from "../services/api";

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const isRegister = useMemo(() => mode === "register", [mode]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verificationNeeded, setVerificationNeeded] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    setVerificationNeeded(false);

    try {
      const payload = {
        email: form.email,
        password: form.password,
        ...(isRegister ? { name: form.name } : {}),
      };

      const result = isRegister ? await registerUser(payload) : await loginUser(payload);

      if (result?.token) {
        setAuthToken(result.token);
        if (isRegister) {
          navigate("/onboarding");
          return;
        }

        let seller;
        try {
          ({ seller } = await getSellerProfile());
        } catch (profileError) {
          setAuthToken(null);
          throw profileError;
        }
        navigate(seller ? "/dashboard" : "/onboarding", { replace: true });
        return;
      }

      if (result?.verificationRequired) {
        setNotice(result.message || "Check your email for a verification link before signing in.");
        return;
      }

      throw new Error("The server did not complete authentication. Please try again.");
    } catch (requestError) {
      const message = requestError?.response?.data?.message || requestError?.message;

      if (requestError?.response?.status === 403 && /verify your email/i.test(message || "")) {
        setVerificationNeeded(true);
      }

      if (!requestError?.response || requestError?.code === "ERR_NETWORK") {
        setError("We couldn't reach the server. Please start the backend and try again.");
        return;
      }

      setError(message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await resendVerificationEmail(form.email);
      setNotice(result?.message || "If this account needs verification, a new link will be sent to its email address.");
      setVerificationNeeded(false);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to resend the verification email right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-visual">
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.12)", fontWeight: 800 }}>
                S
              </div>
              <div>
                <div style={{ fontSize: 12, letterSpacing: "0.18em", opacity: 0.8 }}>SUPPLY LINK</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Seller Studio</div>
              </div>
            </div>

            <h1>Grow your business with smarter sales.</h1>
            <p>
              Manage inventory, take orders, and track daily performance from one modern workspace built for modern sellers.
            </p>
          </div>

          <div className="feature-list">
            <div>✓ Inventory and stock tracking</div>
            <div>✓ AI-driven demand insights</div>
            <div>✓ Customer and order management</div>
          </div>
        </div>

        <div className="auth-form-panel">
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", color: "#67806d", textTransform: "uppercase" }}>
              {isRegister ? "Create account" : "Welcome back"}
            </p>
            <h2 style={{ margin: "8px 0 0", fontSize: "2rem", color: "#183721" }}>
              {isRegister ? "Start selling smarter" : "Sign in to Supply Link"}
            </h2>
          </div>

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 8, color: "#32473c" }}>Full name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Your business name"
                  required={isRegister}
                />
              </div>
            )}

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 8, color: "#32473c" }}>Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 8, color: "#32473c" }}>Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>

            {notice && (
              <div role="status" style={{ color: "#285b39", background: "#eef8ef", border: "1px solid #cde5d0", borderRadius: 10, padding: 10, fontSize: 14 }}>
                {notice}
              </div>
            )}

            {error && (
              <div style={{ color: "#9a2f35", background: "#fff0f1", border: "1px solid #f7ced2", borderRadius: 10, padding: 10, fontSize: 14 }}>
                {error}
                {verificationNeeded && !isRegister && (
                  <button type="button" disabled={loading || !form.email} onClick={handleResendVerification} className="mt-2 block font-bold underline disabled:opacity-60">
                    Resend verification email
                  </button>
                )}
              </div>
            )}

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? (isRegister ? "Creating account..." : "Signing in...") : isRegister ? "Create account" : "Sign in"}
            </button>

            <div style={{ color: "#597161", fontSize: 14 }}>
              {isRegister ? "Already have an account? " : "Need an account? "}
              <Link className="secondary-link" to={isRegister ? "/login" : "/register"}>
                {isRegister ? "Sign in" : "Create one"}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
