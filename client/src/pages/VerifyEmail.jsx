import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../services/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState(token ? "checking" : "error");
  const [message, setMessage] = useState(token
    ? "Verifying your email address…"
    : "This verification link is missing its token. Request a new account link or contact support.");

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => { active = false; };
    }

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

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f3ee] p-6">
      <section className="w-full max-w-md rounded-3xl border border-[#e3e9e1] bg-white p-8 text-center shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#64816b]">Supply Link account</p>
        <h1 className="mt-3 text-2xl font-bold text-[#183721]">
          {status === "success" ? "Email verified" : status === "error" ? "Could not verify email" : "Checking your email"}
        </h1>
        <p role="status" className="mt-3 text-sm leading-6 text-[#667266]">{message}</p>
        {status !== "checking" && (
          <Link to="/login" className="mt-6 inline-flex rounded-xl bg-[#215c39] px-5 py-3 text-sm font-bold text-white">
            Go to sign in
          </Link>
        )}
      </section>
    </main>
  );
}
