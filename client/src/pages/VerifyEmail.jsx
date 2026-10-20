import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, CircleAlert, Layers, LoaderCircle } from "lucide-react";
import { verifyEmail } from "../services/api";
import "./AuthOnboarding.css";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState(token ? "checking" : "error");
  const [message, setMessage] = useState(token
    ? "We’re checking the link with the server. This should only take a moment."
    : "This verification link is missing its token. Request a new account link or contact support.");

  useEffect(() => {
    let active = true;
    if (!token) return () => { active = false; };

    verifyEmail(token)
      .then((result) => {
        if (!active) return;
        setStatus("success");
        setMessage(result?.message || "Your email is verified. You can sign in now.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error?.response?.data?.message || "This verification link is invalid or has expired.");
      });

    return () => { active = false; };
  }, [token]);

  const isChecking = status === "checking";
  const isSuccess = status === "success";

  return (
    <main className="sl-auth-page sl-verify-page">
      <div className="sl-verify-frame">
        <Link to="/" className="sl-brand" aria-label="Supply Link home">
          <span className="sl-brand-mark"><Layers size={19} aria-hidden="true" /></span>
          <span className="sl-brand-copy"><strong>Supply Link</strong><small>SELLER WORKSPACE</small></span>
        </Link>

        <section className="sl-verify-panel" aria-labelledby="verify-title" aria-live="polite">
          <div className={`sl-state-icon ${isSuccess ? "is-success" : isChecking ? "is-pending" : "is-error"}`}>
            {isChecking && <LoaderCircle className="sl-spinner" size={24} aria-hidden="true" />}
            {isSuccess && <CheckCircle2 size={25} aria-hidden="true" />}
            {!isChecking && !isSuccess && <CircleAlert size={25} aria-hidden="true" />}
          </div>
          <p className="sl-eyebrow">Account verification</p>
          <h1 id="verify-title">
            {isSuccess ? "Email verified" : isChecking ? "Verifying your email" : "We couldn’t verify this link"}
          </h1>
          <p className="sl-verify-message">{message}</p>
          {isChecking ? (
            <p className="sl-verify-wait" role="status">Please keep this page open while we check your link.</p>
          ) : (
            <Link className="sl-auth-submit sl-verify-action" to="/login">
              <span>{isSuccess ? "Continue to sign in" : "Go to sign in"}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          )}
        </section>
        <p className="sl-verify-footnote">If this link has expired, return to sign in and request another verification email.</p>
      </div>
    </main>
  );
}
