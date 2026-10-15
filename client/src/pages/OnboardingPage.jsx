import { useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, ExternalLink, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { onboardSeller } from "../services/api";
import { getStoreUrl, slugify } from "../utils/slugify";
import { notifyUser } from "../utils/notifications";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: "",
    storeSlug: "",
    category: "Fashion",
    whatsapp: "",
    phone: "",
    description: "",
    faqs: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("idle");

  const storeSlug = useMemo(() => {
    const generated = slugify(form.businessName || form.storeSlug || "mystore");
    return generated || "mystore";
  }, [form.businessName, form.storeSlug]);

  const liveStoreUrl = useMemo(() => getStoreUrl(storeSlug), [storeSlug]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => {
      const next = { ...previous, [name]: value };

      if (name === "businessName" && value.trim()) {
        next.storeSlug = slugify(value);
      }

      return next;
    });
  };

  const copyStoreLink = async () => {
    if (!liveStoreUrl) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(liveStoreUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = liveStoreUrl;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, textArea.value.length);
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopyStatus("copied");
      notifyUser({ title: "Link copied", message: "Your store URL is ready to share." });
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("failed");
      notifyUser({
        title: "Copy unavailable",
        message: "Clipboard access was blocked. Please select the URL and copy it manually.",
        tone: "warning",
      });
      window.setTimeout(() => setCopyStatus("idle"), 2200);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const finalSlug = slugify(form.storeSlug || form.businessName || "mystore");
      const payload = {
        ...form,
        businessName: form.businessName.trim(),
        storeSlug: finalSlug,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        faqs: form.faqs.trim(),
      };

      await onboardSeller(payload);
      notifyUser({ title: "Store published", message: `Your storefront is live at ${getStoreUrl(finalSlug)}` });
      setSubmitted(true);
      setTimeout(() => navigate("/dashboard"), 1100);
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        requestError?.message ||
        "Unable to save your seller profile.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        <div className="onboarding-hero">
          <div className="mini-logo">S</div>
          <p className="eyebrow">SELLER ONBOARDING</p>
          <h1>Set up your store in under 5 minutes.</h1>
          <p>
            Create your business profile, choose a plan, and get ready to publish a storefront designed for social commerce.
          </p>

          <div className="check-list">
            <div><CheckCircle2 size={16} /> Storefront published in minutes</div>
            <div><CheckCircle2 size={16} /> Product and inventory management</div>
            <div><CheckCircle2 size={16} /> AI insights and business reporting</div>
          </div>
        </div>

        <div className="onboarding-form-panel">
          <div className="panel-header-row">
            <div>
              <div className="eyebrow small">BUSINESS PROFILE</div>
              <h2>Start selling</h2>
            </div>
            <Sparkles size={20} className="sparkle" />
          </div>

          {!submitted ? (
            <>
              <div className="store-link-preview">
                <div className="store-link-preview__header">
                  <span>Store link</span>
                  <button type="button" onClick={copyStoreLink}>
                    {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Retry" : "Copy"}
                  </button>
                </div>
                <div className="store-link-preview__url">{liveStoreUrl || "https://your-store-url.com"}</div>
                <div className="store-link-preview__meta">
                  <span>{storeSlug}</span>
                  <a href={liveStoreUrl || "#"} target="_blank" rel="noreferrer">Preview <ExternalLink size={13} /></a>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="onboarding-form">
                <div className="field-group">
                  <label>Business name</label>
                  <input name="businessName" value={form.businessName} onChange={handleChange} placeholder="GreenRoots Studio" required />
                </div>

                <div className="field-group">
                  <label>Store slug</label>
                  <input name="storeSlug" value={form.storeSlug || storeSlug} onChange={handleChange} placeholder="greenroots" required />
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>Category</label>
                    <select name="category" value={form.category} onChange={handleChange}>
                      <option>Fashion</option>
                      <option>Home</option>
                      <option>Beauty</option>
                      <option>Accessories</option>
                    </select>
                  </div>

                  <div className="field-group">
                    <label>Subscription</label>
                    <p className="rounded-xl border border-[#e1e8df] bg-[#f8faf8] px-3 py-3 text-sm text-[#516658]">Start with the free plan. Choose a paid plan later through Razorpay in Billing.</p>
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>Phone</label>
                    <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+919000000000" pattern="\+[1-9][0-9]{7,14}" required />
                  </div>

                  <div className="field-group">
                    <label>WhatsApp</label>
                    <input name="whatsapp" type="tel" value={form.whatsapp} onChange={handleChange} placeholder="+919876543210" pattern="\+[1-9][0-9]{7,14}" required />
                    <small>Use the full international number, including country code. For example, India uses +91 followed by a 10-digit mobile number.</small>
                  </div>
                </div>

                <div className="field-group">
                  <label>Store description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Tell customers what makes your store special." />
                </div>

                <div className="field-group">
                  <label>FAQ answers</label>
                  <textarea
                    name="faqs"
                    value={form.faqs}
                    onChange={handleChange}
                    rows={4}
                    placeholder="What type of products do you sell? | Premium everyday essentials and lifestyle products&#10;How fast is delivery? | Usually within 2–3 days in your city"
                  />
                </div>

                {error && (
                  <div style={{ color: "#9a2f35", background: "#fff0f1", border: "1px solid #f7ced2", borderRadius: 10, padding: 10, fontSize: 14 }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="onboarding-submit" disabled={loading}>
                  {loading ? "Creating store..." : "Create store"} <ArrowRight size={16} />
                </button>
              </form>
            </>
          ) : (
            <div className="success-box">
              <Building2 size={30} />
              <h3>Store setup complete</h3>
              <p>
                Your store <strong>{form.businessName || "GreenRoots Studio"}</strong> is ready for products and inventory setup.
              </p>
              <Link to="/dashboard" className="success-link">Open dashboard</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
