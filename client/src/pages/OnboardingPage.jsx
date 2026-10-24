import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Copy, ExternalLink, Layers, LoaderCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getSellerProfile, onboardSeller } from "../services/api";
import { getStoreUrl, slugify } from "../utils/slugify";
import { notifyUser } from "../utils/notifications";
import "./AuthOnboarding.css";

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
  const [profileCheck, setProfileCheck] = useState("checking");
  const [paymentQrFile, setPaymentQrFile] = useState(null);
  const [paymentQrNotice, setPaymentQrNotice] = useState("");

  useEffect(() => {
    let active = true;
    getSellerProfile()
      .then(({ seller }) => {
        if (!active) return;
        if (seller) {
          navigate("/dashboard", { replace: true });
          return;
        }
        setProfileCheck("ready");
      })
      .catch(() => {
        if (active) setProfileCheck("error");
      });
    return () => { active = false; };
  }, [navigate]);

  const retryProfileCheck = () => {
    setProfileCheck("checking");
    getSellerProfile()
      .then(({ seller }) => {
        if (seller) navigate("/dashboard", { replace: true });
        else setProfileCheck("ready");
      })
      .catch(() => setProfileCheck("error"));
  };

  const storeSlug = useMemo(() => {
    const generated = slugify(form.businessName || form.storeSlug || "mystore");
    return generated || "mystore";
  }, [form.businessName, form.storeSlug]);
  const liveStoreUrl = useMemo(() => getStoreUrl(storeSlug), [storeSlug]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => {
      const next = { ...previous, [name]: value };
      if (name === "businessName" && value.trim()) next.storeSlug = slugify(value);
      return next;
    });
  };

  const handleQrSelection = async (event) => {
    const file = event.target.files?.[0];
    setPaymentQrFile(null);
    setPaymentQrNotice("");
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setPaymentQrNotice("Choose a PNG or JPEG QR image no larger than 2 MB.");
      event.target.value = "";
      return;
    }
    try {
      const image = await createImageBitmap(file);
      const valid = image.width >= 300 && image.height >= 300 && image.width <= 3000 && image.height <= 3000;
      image.close();
      if (!valid) throw new Error("Choose a QR image between 300 x 300 and 3000 x 3000 pixels.");
      setPaymentQrFile(file);
    } catch (selectionError) {
      setPaymentQrNotice(selectionError.message || "Unable to read this QR image.");
      event.target.value = "";
    }
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
        message: "Clipboard access was blocked. Select the URL and copy it manually.",
        tone: "warning",
      });
      window.setTimeout(() => setCopyStatus("idle"), 2200);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!paymentQrFile) {
      setPaymentQrNotice("Upload the seller payment QR to create your store.");
      return;
    }
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
      const result = await onboardSeller(payload, paymentQrFile);
      if (result?.alreadyExists) {
        navigate("/dashboard", { replace: true });
        return;
      }
      setPaymentQrNotice("");
      notifyUser({ title: "Store published", message: `Your storefront is live at ${getStoreUrl(finalSlug)}` });
      setSubmitted(true);
      setTimeout(() => navigate("/dashboard"), 3000);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || "Unable to save your seller profile.");
    } finally {
      setLoading(false);
    }
  };

  if (profileCheck === "checking") {
    return (
      <main className="sl-auth-page sl-onboarding-state" role="status" aria-live="polite">
        <div className="sl-state-message"><LoaderCircle className="sl-spinner" size={22} aria-hidden="true" /><span>Checking your existing store…</span></div>
      </main>
    );
  }

  if (profileCheck === "error") {
    return (
      <main className="sl-auth-page sl-onboarding-state">
        <section className="sl-verify-panel" aria-labelledby="profile-check-title">
          <div className="sl-state-icon is-error"><Building2 size={24} aria-hidden="true" /></div>
          <p className="sl-eyebrow">Store setup</p>
          <h1 id="profile-check-title">Could not check your store</h1>
          <p className="sl-verify-message">Reconnect to the server before creating a store. This helps protect a store that may already belong to your account.</p>
          <button type="button" className="sl-auth-submit" onClick={retryProfileCheck}><span>Try again</span><ArrowRight size={17} aria-hidden="true" /></button>
        </section>
      </main>
    );
  }

  return (
    <main className="sl-onboarding-page">
      <div className="sl-onboarding-frame">
        <header className="sl-onboarding-topbar">
          <Link to="/" className="sl-brand" aria-label="Supply Link home">
            <span className="sl-brand-mark"><Layers size={19} aria-hidden="true" /></span>
            <span className="sl-brand-copy"><strong>Supply Link</strong><small>SELLER WORKSPACE</small></span>
          </Link>
          <span className="sl-onboarding-step">SELLER SETUP</span>
        </header>

        <div className="sl-onboarding-layout">
          <section className="sl-onboarding-intro" aria-labelledby="onboarding-title">
            <p className="sl-eyebrow">Your shop, thoughtfully set up</p>
            <h1 id="onboarding-title">Give your business a place to be found.</h1>
            <p>Start with the details customers need to recognize your shop and get in touch. You can add products from your workspace after setup.</p>
            <div className="sl-onboarding-note">
              <span className="sl-note-mark"><CheckCircle2 size={17} aria-hidden="true" /></span>
              <div><strong>Your shop link is prepared as you type.</strong><span>Review the address before creating your store.</span></div>
            </div>
          </section>

          <section className="sl-onboarding-panel" aria-labelledby="setup-form-title">
            {!submitted ? (
              <>
                <div className="sl-onboarding-panel-heading">
                  <p className="sl-eyebrow">Business profile</p>
                  <h2 id="setup-form-title">Store details</h2>
                  <p>Fields marked required are needed to publish the storefront.</p>
                </div>

                <div className="sl-store-preview">
                  <div className="sl-preview-topline"><span>Public store address</span><span className="sl-preview-live"><i aria-hidden="true" /> Preview</span></div>
                  <div className="sl-preview-url-row">
                    <a className="sl-preview-url" href={liveStoreUrl} target="_blank" rel="noreferrer" title={liveStoreUrl}>{liveStoreUrl}</a>
                    <button type="button" onClick={copyStoreLink} aria-label={copyStatus === "copied" ? "Store link copied" : "Copy store link"}>
                      <Copy size={16} aria-hidden="true" /><span>{copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Retry" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="sl-preview-caption">Your unique shop address: <strong>{storeSlug}</strong></p>
                </div>

                <form className="sl-onboarding-form" onSubmit={handleSubmit}>
                  <div className="sl-form-section">
                    <h3>About your shop</h3>
                    <div className="sl-field">
                      <label htmlFor="shop-name">Business name <span>Required</span></label>
                      <input id="shop-name" name="businessName" autoComplete="organization" value={form.businessName} onChange={handleChange} placeholder="e.g. GreenRoots Studio" required />
                    </div>
                    <div className="sl-field">
                      <label htmlFor="shop-slug">Store URL name <span>Required</span></label>
                      <div className="sl-slug-field"><span aria-hidden="true">/store/</span><input id="shop-slug" name="storeSlug" autoCapitalize="none" value={form.storeSlug || storeSlug} onChange={handleChange} placeholder="greenroots" required aria-describedby="slug-help" /></div>
                      <p id="slug-help" className="sl-field-help">Use a short name customers can remember. Availability is checked when you create the store.</p>
                    </div>
                    <div className="sl-field">
                      <label htmlFor="shop-category">Category <span>Required</span></label>
                      <select id="shop-category" name="category" value={form.category} onChange={handleChange} required>
                        <option>Fashion</option><option>Home</option><option>Beauty</option><option>Accessories</option>
                      </select>
                    </div>
                    <div className="sl-field">
                      <label htmlFor="shop-description">Store description <span>Optional</span></label>
                      <textarea id="shop-description" name="description" value={form.description} onChange={handleChange} rows={3} placeholder="A short introduction to your shop." />
                    </div>
                  </div>

                  <div className="sl-form-section">
                    <h3>Contact and payment</h3>
                    <div className="sl-field-row">
                      <div className="sl-field">
                        <label htmlFor="shop-phone">Phone number <span>Required</span></label>
                        <input id="shop-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={handleChange} placeholder="+919000000000" pattern="\+[1-9][0-9]{7,14}" required />
                      </div>
                      <div className="sl-field">
                        <label htmlFor="shop-whatsapp">WhatsApp number <span>Required</span></label>
                        <input id="shop-whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={handleChange} placeholder="+919876543210" pattern="\+[1-9][0-9]{7,14}" required aria-describedby="whatsapp-help" />
                        <p id="whatsapp-help" className="sl-field-help">Include the country code, such as +91 for India.</p>
                      </div>
                    </div>
                    <div className="sl-field">
                      <label htmlFor="payment-qr">Seller UPI payment QR <span>Required</span></label>
                      <input id="payment-qr" className="sl-file-input" type="file" accept="image/png,image/jpeg" onChange={handleQrSelection} required aria-invalid={Boolean(paymentQrNotice)} aria-describedby={paymentQrNotice ? "qr-help qr-feedback" : "qr-help"} />
                      <p id="qr-help" className="sl-field-help">PNG or JPEG, image between 300 and 3000 pixels, up to 2 MB. Check the payee name before uploading.</p>
                      {paymentQrFile && <p className="sl-file-selected" role="status">Selected: {paymentQrFile.name}</p>}
                      {paymentQrNotice && <p id="qr-feedback" className="sl-inline-error" role="alert">{paymentQrNotice}</p>}
                    </div>
                  </div>

                  <div className="sl-form-section">
                    <h3>Useful details</h3>
                    <div className="sl-field">
                      <label htmlFor="shop-faqs">Frequently asked questions <span>Optional</span></label>
                      <textarea id="shop-faqs" name="faqs" value={form.faqs} onChange={handleChange} rows={3} placeholder={'Question | Answer\nExample: How long is delivery? | Usually 2–3 days in your city'} />
                      <p className="sl-field-help">Add any answers customers often ask for. You can leave this blank for now.</p>
                    </div>
                    <div className="sl-plan-note"><span>Plan</span><p>Start with the free plan. You can choose a paid plan later in Billing.</p></div>
                  </div>

                  {error && <div className="sl-feedback sl-feedback--error" role="alert">{error}</div>}
                  <button type="submit" className="sl-auth-submit" disabled={loading} aria-busy={loading}>
                    <span>{loading ? "Creating your store…" : "Create store"}</span>{!loading && <ArrowRight size={17} aria-hidden="true" />}
                  </button>
                  <p className="sl-form-footnote">Your store is created after the server validates these details and the payment QR.</p>
                </form>
              </>
            ) : (
              <div className="sl-onboarding-success" role="status" aria-live="polite">
                <div className="sl-state-icon is-success"><CheckCircle2 size={25} aria-hidden="true" /></div>
                <p className="sl-eyebrow">Store published</p>
                <h2>Setup is complete.</h2>
                <p><strong>{form.businessName}</strong> is ready. Add products from your workspace to start filling your storefront.</p>
                <a className="sl-success-link" href={liveStoreUrl} target="_blank" rel="noreferrer">Preview your store <ExternalLink size={15} aria-hidden="true" /></a>
                <Link className="sl-auth-submit" to="/dashboard"><span>Open workspace</span><ArrowRight size={17} aria-hidden="true" /></Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
