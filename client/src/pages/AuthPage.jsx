import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Layers } from "lucide-react";
import { getSellerProfile, loginUser, registerUser, resendVerificationEmail, setAuthToken } from "../services/api";
import "./AuthOnboarding.css";

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const isRegister = useMemo(() => mode === "register", [mode]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verificationNeeded, setVerificationNeeded] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

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
        setError("We couldn't reach the server. Please try again in a moment.");
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
    <main className="sl-auth-page">
      <div className="sl-auth-frame">
        <header className="sl-auth-topbar">
          <Link to="/" className="sl-brand" aria-label="Supply Link home">
            <span className="sl-brand-mark"><Layers size={19} aria-hidden="true" /></span>
            <span className="sl-brand-copy"><strong>Supply Link</strong><small>SELLER WORKSPACE</small></span>
          </Link>
          <p>{isRegister ? "Already have an account?" : "New to Supply Link?"}</p>
          <Link className="sl-auth-switch" to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </header>

        <div className="sl-auth-layout">
          <section className="sl-auth-intro" aria-labelledby="auth-intro-title">
            <p className="sl-eyebrow">A calmer way to run your shop</p>
            <h1 id="auth-intro-title">Good business starts with a clear picture.</h1>
            <p className="sl-auth-description">
              Keep your products, stock, orders, and customer conversations together in one practical workspace.
            </p>
            <div className="sl-auth-ledger" aria-hidden="true">
              <div><span>Products</span><b>One clear catalogue</b></div>
              <div><span>Orders</span><b>Every request in view</b></div>
              <div><span>Storefront</span><b>Ready to share</b></div>
            </div>
          </section>

          <section className="sl-auth-panel" aria-labelledby="auth-form-title">
            <div className="sl-auth-panel-heading">
              <p className="sl-eyebrow">{isRegister ? "Create your account" : "Welcome back"}</p>
              <h2 id="auth-form-title">{isRegister ? "Start selling smarter" : "Sign in to Supply Link"}</h2>
              <p>{isRegister ? "Set up your seller account to create your shop." : "Sign in to continue to your seller workspace."}</p>
            </div>

            <form className="sl-auth-form" onSubmit={handleSubmit} noValidate={false}>
              {isRegister && (
                <div className="sl-field">
                  <label htmlFor="auth-name">Full name</label>
                  <input id="auth-name" autoComplete="name" type="text" name="name" value={form.name} onChange={handleChange} placeholder="Your name" required />
                </div>
              )}

              <div className="sl-field">
                <label htmlFor="auth-email">Email address</label>
                <input id="auth-email" autoComplete="email" inputMode="email" type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required aria-invalid={Boolean(error)} aria-describedby={error ? "auth-feedback" : undefined} />
              </div>

              <div className="sl-field">
                <label htmlFor="auth-password">Password</label>
                <div className="sl-password-wrap">
                  <input id="auth-password" autoComplete={isRegister ? "new-password" : "current-password"} type={passwordVisible ? "text" : "password"} name="password" value={form.password} onChange={handleChange} placeholder={isRegister ? "At least 8 characters" : "Enter your password"} minLength={isRegister ? 8 : undefined} required aria-invalid={Boolean(error)} aria-describedby={error ? "auth-feedback" : undefined} />
                  <button className="sl-password-toggle" type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Hide characters" : "Show characters"} aria-pressed={passwordVisible}>
                    {passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
                {isRegister && <p className="sl-field-help">Use at least 8 characters.</p>}
              </div>

              {notice && <div id="auth-feedback" className="sl-feedback sl-feedback--success" role="status">{notice}</div>}
              {error && (
                <div id="auth-feedback" className="sl-feedback sl-feedback--error" role="alert">
                  <span>{error}</span>
                  {verificationNeeded && !isRegister && (
                    <button type="button" disabled={loading || !form.email} onClick={handleResendVerification}>
                      {loading ? "Sending…" : "Resend verification email"}
                    </button>
                  )}
                </div>
              )}

              <button className="sl-auth-submit" type="submit" disabled={loading} aria-busy={loading}>
                <span>{loading ? (isRegister ? "Creating account…" : "Signing in…") : isRegister ? "Create account" : "Sign in"}</span>
                {!loading && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </form>

            <p className="sl-auth-legal">By continuing, you agree to use Supply Link in line with your business and customer responsibilities.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
