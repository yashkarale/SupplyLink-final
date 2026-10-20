import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Check, ExternalLink, LogOut, QrCode, ShieldCheck, Store, Upload, UserRound } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { getSellerProfile, updateSellerStoreSettings, uploadSellerPaymentQr } from "../services/api";
import { getStoreUrl } from "../utils/slugify";

const fieldClass = "mt-1.5 w-full min-w-0 border border-[#e2dccf] bg-[#fffdf9] px-3 py-2.5 text-sm text-[#1c1a17] outline-none transition-colors placeholder:text-[#8b8377] focus-visible:border-[#d98a1f] focus-visible:ring-2 focus-visible:ring-[#d98a1f]/25";
const panelClass = "min-w-0 border border-[#e2dccf] bg-[#fffdf9] p-4 text-[#1c1a17] sm:p-6";
const labelClass = "block text-sm font-semibold text-[#1c1a17]";
const muted = "text-[#6f685d]";
const editableFields = ["businessName", "storeSlug", "description", "whatsapp"];
const snapshot = (seller) => Object.fromEntries(editableFields.map((key) => [key, seller?.[key] || ""]));

export default function Settings() {
  const { theme = "light" } = useOutletContext() || {};
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [qrSaving, setQrSaving] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrSaved, setQrSaved] = useState(false);

  const dirty = useMemo(() => Boolean(profile && original && editableFields.some((key) => (profile[key] || "") !== (original[key] || ""))), [profile, original]);

  useEffect(() => {
    let active = true;
    getSellerProfile().then(({ seller }) => {
      if (!active) return;
      if (!seller) { setError("Complete seller onboarding before editing store settings."); return; }
      setProfile(seller);
      setOriginal(snapshot(seller));
    }).catch((requestError) => {
      if (active) setError(requestError?.response?.data?.message || "Unable to load store settings.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (key, value) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError("");
  };

  const updateProfile = async (event) => {
    event.preventDefault();
    if (!profile || !dirty) return;
    setSaving(true); setSaved(false); setError("");
    try {
      const { seller } = await updateSellerStoreSettings(snapshot(profile));
      setProfile(seller);
      setOriginal(snapshot(seller));
      setSaved(true);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to save store settings.");
    } finally { setSaving(false); }
  };

  const handleQrUpload = async (event) => {
    const file = event.target.files?.[0];
    setQrError(""); setQrSaved(false);
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setQrError("Choose a PNG or JPEG QR image no larger than 2 MB."); event.target.value = ""; return;
    }
    setQrSaving(true);
    try {
      const image = await createImageBitmap(file);
      const ratio = Math.max(image.width, image.height) / Math.min(image.width, image.height);
      const valid = image.width >= 300 && image.height >= 300 && image.width <= 3000 && image.height <= 3000 && ratio <= 1.05;
      image.close();
      if (!valid) throw new Error("Use a square QR image between 300 × 300 and 3000 × 3000 pixels.");
      const response = await uploadSellerPaymentQr(file);
      setProfile((current) => ({ ...current, ...response.seller }));
      setQrSaved(true);
    } catch (uploadError) {
      setQrError(uploadError?.response?.data?.message || uploadError.message || "Unable to upload the payment QR image.");
    } finally { setQrSaving(false); event.target.value = ""; }
  };

  const logout = () => {
    if (dirty && !window.confirm("You have unsaved store changes. Sign out and discard them?")) return;
    localStorage.removeItem("supplylink_token");
    navigate("/login", { replace: true });
  };

  const storeUrl = getStoreUrl(profile?.storeSlug);
  const navItems = [{ id: "store-profile", label: "Store profile", Icon: Store }, { id: "account", label: "Account", Icon: UserRound }, { id: "session", label: "Session", Icon: ShieldCheck }];

  return <div className="space-y-6">
    <PageHeader title="Settings" description="Manage the public details and seller account connected to your store." theme={theme} />
    {loading ? <div className={`${panelClass} text-sm ${muted}`} role="status">Loading current settings…</div>
      : error && !profile ? <div className={`${panelClass} flex flex-wrap items-center justify-between gap-3`}><p role="alert" className="text-sm text-[#8b332d]">{error}</p><button type="button" onClick={() => window.location.reload()} className="text-sm font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d98a1f]">Retry</button></div>
        : <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
          <nav aria-label="Settings sections" className="flex min-w-0 gap-2 overflow-x-auto lg:sticky lg:top-4 lg:h-fit lg:flex-col lg:overflow-visible">
            {navItems.map(({ id, label, Icon }) => <a key={id} href={`#${id}`} className="inline-flex min-h-10 shrink-0 items-center gap-2 border border-transparent px-3 text-sm font-medium text-[#6f685d] transition-colors hover:border-[#e2dccf] hover:bg-[#fffdf9] hover:text-[#1c1a17] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d98a1f]"><Icon size={16} aria-hidden="true" />{label}</a>)}
          </nav>

          <div className="min-w-0 space-y-5">
            <form id="store-profile" onSubmit={updateProfile} className={panelClass}>
              <div className="mb-5"><h2 className="font-[Fraunces] text-xl">Store profile</h2><p className={`mt-1 text-sm ${muted}`}>These details appear on your public storefront.</p></div>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass} htmlFor="business-name">Business name <span aria-hidden="true">*</span></label><input id="business-name" required maxLength={120} value={profile?.businessName || ""} onChange={(e) => change("businessName", e.target.value)} className={fieldClass} autoComplete="organization" /><p className={`mt-1 text-xs ${muted}`}>Up to 120 characters.</p></div>
                <div><label className={labelClass} htmlFor="store-slug">Store URL slug <span aria-hidden="true">*</span></label><div className="mt-1.5 flex min-w-0 border border-[#e2dccf] focus-within:border-[#d98a1f] focus-within:ring-2 focus-within:ring-[#d98a1f]/25"><span className="flex shrink-0 items-center border-r border-[#e2dccf] bg-[#f7f4ee] px-2.5 text-xs text-[#6f685d]">/store/</span><input id="store-slug" required pattern="[a-z0-9-]+" maxLength={60} value={profile?.storeSlug || ""} onChange={(e) => change("storeSlug", e.target.value)} aria-describedby="slug-help" className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none" /></div><p id="slug-help" className={`mt-1 text-xs ${muted}`}>Lowercase letters, numbers, and hyphens. Availability is checked when saved.</p></div>
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="whatsapp">WhatsApp ordering number <span aria-hidden="true">*</span></label><input id="whatsapp" type="tel" required pattern="\+[1-9][0-9]{7,14}" maxLength={16} placeholder="+919876543210" value={profile?.whatsapp || ""} onChange={(e) => change("whatsapp", e.target.value)} className={fieldClass} autoComplete="tel" aria-describedby="whatsapp-help" /><p id="whatsapp-help" className={`mt-1 text-xs ${muted}`}>Use international format with country code.</p></div>
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="description">Store description</label><textarea id="description" maxLength={1200} rows={4} value={profile?.description || ""} onChange={(e) => change("description", e.target.value)} className={`${fieldClass} resize-y`} aria-describedby="description-help" /><p id="description-help" className={`mt-1 text-xs ${muted}`}>Optional · up to 1,200 characters.</p></div>
              </div>

              <div className="mt-5 border-t border-[#e2dccf] pt-5">
                <h3 className="text-sm font-semibold">Public storefront</h3><p className={`mt-1 text-xs ${muted}`}>Customers can browse your published catalog at this address.</p>
                <div className="mt-3 flex min-w-0 flex-col gap-3 border border-[#e2dccf] bg-[#f7f4ee] p-3 sm:flex-row sm:items-center sm:justify-between"><p className="min-w-0 break-all text-sm">{storeUrl || "A URL will appear when your store slug is set."}</p><a href={storeUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!storeUrl} onClick={(e) => { if (!storeUrl) e.preventDefault(); }} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 border border-[#e2dccf] bg-[#fffdf9] px-3 text-sm font-semibold hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d98a1f] aria-disabled:cursor-not-allowed aria-disabled:opacity-50">View store <ExternalLink size={14} aria-hidden="true" /></a></div>
              </div>

              <div className="mt-5 border-t border-[#e2dccf] pt-5">
                <div className="flex items-start gap-3"><QrCode size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#a86a16]" /><div className="min-w-0"><h3 className="text-sm font-semibold">UPI payment QR</h3><p className={`mt-1 text-xs leading-relaxed ${muted}`}>Customers can use this QR at checkout to pay you directly. PNG or JPEG, square image, 300–3,000 px, maximum 2 MB.</p>
                  {profile?.paymentQrUrl && <img src={profile.paymentQrUrl} alt="Current UPI payment QR" className="mt-3 size-32 border border-[#e2dccf] bg-white object-contain p-2" />}
                  <label className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 border border-[#1c1a17] bg-[#1c1a17] px-3 text-sm font-semibold text-[#fffdf9] transition-colors hover:bg-[#38332b] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#d98a1f]"> <Upload size={15} aria-hidden="true" />{qrSaving ? "Uploading…" : profile?.paymentQrUrl ? "Replace QR image" : "Upload QR image"}<input type="file" accept="image/png,image/jpeg" onChange={handleQrUpload} disabled={qrSaving} className="sr-only" aria-label="Upload UPI payment QR image" /></label>
                  {qrError && <p role="alert" className="mt-2 text-sm text-[#8b332d]">{qrError}</p>}{qrSaved && <p role="status" className="mt-2 flex items-center gap-1.5 text-sm text-[#3d5d2b]"><Check size={15} />Payment QR updated.</p>}
                </div></div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#e2dccf] pt-5"><Button type="submit" loading={saving} disabled={!dirty || saving}>Save store profile</Button>{dirty && <span className={`text-xs ${muted}`}>Unsaved changes</span>}</div>
              {error && <p role="alert" className="mt-3 text-sm text-[#8b332d]">{error}</p>}{saved && <p role="status" className="mt-3 flex items-center gap-1.5 text-sm text-[#3d5d2b]"><Check size={15} />Store profile saved.</p>}
            </form>

            <section id="account" className={panelClass}><h2 className="font-[Fraunces] text-xl">Account</h2><p className={`mt-1 text-sm ${muted}`}>Your registered sign-in identity.</p><div className="mt-4 max-w-lg"><label className={labelClass} htmlFor="account-email">Registered email</label><input id="account-email" type="email" value={profile?.email || ""} readOnly className={`${fieldClass} bg-[#f7f4ee]`} /></div></section>

            <section id="session" className={panelClass}><h2 className="font-[Fraunces] text-xl">Security & session</h2><div className="mt-3 flex items-start gap-3 border border-[#e2dccf] bg-[#f7f4ee] p-3"><ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#6f685d]" /><p className={`text-sm leading-relaxed ${muted}`}>Your seller workspace uses the current authenticated session. Sign out here to end this session on this device.</p></div><button type="button" onClick={logout} className="mt-4 inline-flex min-h-10 items-center gap-2 border border-[#e2dccf] bg-[#fffdf9] px-3 text-sm font-semibold text-[#1c1a17] transition-colors hover:bg-[#f7f4ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d98a1f]"><LogOut size={15} aria-hidden="true" />Sign out</button></section>
          </div>
        </div>}
  </div>;
}
