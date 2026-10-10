
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bell, Check, Globe, LockKeyhole, Store, UserRound } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { getStoreUrl } from "../utils/slugify";

export default function Settings() {
  const { theme = "light" } = useOutletContext() || {};
  const isDark = theme === "dark";
  const [profile, setProfile] = useState({ name: "Yash Karale", email: "seller@example.com", storeName: "My Store", slug: "my-store", description: "Quality products, thoughtfully selected." });
  const [preferences, setPreferences] = useState({ orderAlerts: true, stockAlerts: true, weeklyReport: false });
  const [saved, setSaved] = useState(false);

  const updateProfile = (e) => {
    e.preventDefault();
    setSaved(true);
  };

  const previewUrl = getStoreUrl(profile.slug || "my-store");
  const fieldClass = isDark
    ? "mt-2 w-full rounded-xl border border-[#2b423a] bg-[#0f1f1a] px-3.5 py-3 text-sm text-[#edf5ee] outline-none transition placeholder:text-[#7c8d83] focus:border-[#7fb895] focus:ring-2 focus:ring-[#7fb895]/10"
    : "mt-2 w-full rounded-xl border border-[#e1e8df] bg-white px-3.5 py-3 text-sm text-[#354238] outline-none transition focus:border-[#659873] focus:ring-2 focus:ring-[#659873]/10";
  const panelClass = isDark
    ? "scroll-mt-24 rounded-2xl border border-[#21382d] bg-[#12261a] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] sm:p-7"
    : "scroll-mt-24 rounded-2xl border border-[#e9ede7] bg-white p-5 shadow-[0_12px_35px_rgba(21,44,31,0.04)] sm:p-7";
  const labelClass = isDark ? "text-xs font-semibold text-[#dfe9e3]" : "text-xs font-semibold text-[#59675b]";
  const navClass = isDark
    ? "flex gap-2 overflow-x-auto xl:flex-col text-[#dfe9e3]"
    : "flex gap-2 overflow-x-auto xl:flex-col";
  const navButtonClass = isDark
    ? "flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-medium text-[#d9e8dd] hover:bg-[#173128]"
    : "flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-medium text-[#778178] hover:bg-white";
  const mutedTextClass = isDark ? "text-[#a3b6a8]" : "text-[#909b91]";
  const sectionTitleClass = isDark ? "text-sm font-bold text-[#edf5ee]" : "text-sm font-bold text-[#26372b]";
  const previewBoxClass = isDark ? "rounded-xl border border-[#2b423a] bg-[#132d24] p-3 text-[#dfece2]" : "rounded-xl border border-[#e1e8df] bg-[#f7f9f6] p-3 text-[#2f4d3b]";

  return (
    <div>
      <PageHeader title="Settings" description="Manage your seller profile, store details, and preferences." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav className={navClass}>
          {[
            { label: "Store profile", icon: Store },
            { label: "Account", icon: UserRound },
            { label: "Notifications", icon: Bell },
            { label: "Security", icon: LockKeyhole },
          ].map(({ label, icon: Icon }, index) => (
            <button
              key={label}
              onClick={() => document.getElementById(index === 2 ? "notifications" : index === 1 ? "account" : index === 3 ? "security" : "store-profile")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={`${navButtonClass} ${index === 0 ? (isDark ? "bg-[#183128] text-[#dff7e6]" : "bg-[#eaf3ec] text-[#215c39]") : ""}`}
            >
              <Icon size={17} />{label}
            </button>
          ))}
        </nav>

        <div className="space-y-6">
          <form id="store-profile" onSubmit={updateProfile} className={panelClass}>
            <div className="mb-6 flex items-center gap-3"><div className={`rounded-xl p-2.5 ${isDark ? "bg-[#183128] text-[#dff7e6]" : "bg-[#edf4ed] text-[#347048]"}`}><Store size={20} /></div><div><h2 className={sectionTitleClass}>Store profile</h2><p className={`mt-1 text-xs ${mutedTextClass}`}>Control how your business is presented.</p></div></div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className={labelClass}>Store name<input required maxLength={80} value={profile.storeName} onChange={(e) => { setProfile({ ...profile, storeName: e.target.value }); setSaved(false); }} className={fieldClass} /></label>
              <label className={labelClass}>Store URL slug<div className={`mt-2 flex overflow-hidden rounded-xl border ${isDark ? "border-[#2b423a] focus-within:border-[#7fb895]" : "border-[#e1e8df] focus-within:border-[#659873]"}`}><span className={`flex items-center border-r px-3 text-xs ${isDark ? "border-[#2b423a] bg-[#162d24] text-[#a7b9ae]" : "border-[#e1e8df] bg-[#f7f9f6] text-[#8c988e]"}`}>/store/</span><input required pattern="[a-z0-9-]+" maxLength={60} value={profile.slug} onChange={(e) => { setProfile({ ...profile, slug: e.target.value }); setSaved(false); }} className={`min-w-0 flex-1 px-3 py-3 text-sm outline-none ${isDark ? "bg-[#0f1f1a] text-[#edf5ee]" : "bg-white text-[#354238]"}`} /></div></label>
              <label className={`${labelClass} sm:col-span-2`}>Store description<textarea maxLength={300} rows={3} value={profile.description} onChange={(e) => { setProfile({ ...profile, description: e.target.value }); setSaved(false); }} className={fieldClass} /></label>
            </div>

            <div className={`${previewBoxClass} mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
              <div>
                <p className={`text-[10px] uppercase tracking-[0.16em] ${mutedTextClass}`}>Store preview</p>
                <p className="mt-1 break-all text-sm font-semibold">{previewUrl || "https://your-store-url.com"}</p>
              </div>
              <a
                href={previewUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-[#1d4f34] bg-[#215c39] px-4 py-2.5 text-xs font-bold text-white shadow-[0_10px_18px_rgba(33,92,57,0.18)] transition hover:bg-[#18482b]"
              >
                View storefront
              </a>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="submit" className="rounded-xl bg-[#215c39] px-5 py-3 text-xs font-semibold text-white hover:bg-[#18482b]">Save store settings</button>
            </div>
            {saved && <p role="status" className={`mt-3 flex items-center gap-2 text-xs font-medium ${isDark ? "text-[#b9f0c8]" : "text-[#327348]"}`}><Check size={15} /> Changes saved in this session.</p>}
          </form>

          <section id="account" className={panelClass}>
            <div className="mb-6 flex items-center gap-3"><div className={`rounded-xl p-2.5 ${isDark ? "bg-[#183128] text-[#dff7e6]" : "bg-[#edf4ed] text-[#347048]"}`}><UserRound size={20} /></div><div><h2 className={sectionTitleClass}>Account details</h2><p className={`mt-1 text-xs ${mutedTextClass}`}>Your seller account information.</p></div></div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className={labelClass}>Full name<input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className={fieldClass} /></label>
              <label className={labelClass}>Email address<input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className={fieldClass} /></label>
            </div>
            <p className={`mt-4 text-[11px] leading-5 ${isDark ? "text-[#9dad9f]" : "text-[#929d93]"}`}>These fields are placeholders. Account updates and email verification must be handled securely by your backend.</p>
          </section>

          <section id="notifications" className={panelClass}>
            <div className="mb-6 flex items-center gap-3"><div className={`rounded-xl p-2.5 ${isDark ? "bg-[#183128] text-[#dff7e6]" : "bg-[#edf4ed] text-[#347048]"}`}><Bell size={20} /></div><div><h2 className={sectionTitleClass}>Notifications</h2><p className={`mt-1 text-xs ${mutedTextClass}`}>Choose the updates you would like to receive.</p></div></div>
            <div className="space-y-5">
              {[
                { key: "orderAlerts", title: "New order notifications", description: "Get notified when a customer places an order." },
                { key: "stockAlerts", title: "Low-stock alerts", description: "Be notified when products need replenishment." },
                { key: "weeklyReport", title: "Weekly performance summary", description: "Receive a weekly summary of store performance." },
              ].map(({ key, title, description }) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-4">
                  <div>
                    <p className={labelClass}>{title}</p>
                    <p className={`mt-1 text-[11px] leading-5 ${isDark ? "text-[#9dad9f]" : "text-[#929d93]"}`}>{description}</p>
                  </div>
                  <input type="checkbox" checked={preferences[key]} onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })} className="h-4 w-4 accent-[#327348]" />
                </label>
              ))}
            </div>
          </section>

          <section id="security" className={panelClass}>
            <div className="mb-4 flex items-center gap-3"><div className={`rounded-xl p-2.5 ${isDark ? "bg-[#183128] text-[#dff7e6]" : "bg-[#edf4ed] text-[#347048]"}`}><LockKeyhole size={20} /></div><div><h2 className={sectionTitleClass}>Security</h2><p className={`mt-1 text-xs ${mutedTextClass}`}>Account protection and store access.</p></div></div>
            <div className={`flex items-start gap-3 p-4 ${isDark ? "rounded-xl bg-[#162e24] text-[#d3e4d7]" : "rounded-xl bg-[#f7f9f6] text-[#354238]"}`}><Globe size={17} className={`mt-0.5 shrink-0 ${isDark ? "text-[#b8d6c0]" : "text-[#618068]"}`} /><div><p className={labelClass}>Authentication is not connected</p><p className={`mt-1 text-xs leading-5 ${isDark ? "text-[#9dad9f]" : "text-[#929d93]"}`}>Implement server-side authentication, hashed passwords, protected sessions or tokens, and tenant-level authorization before handling real seller data.</p></div></div>
          </section>
        </div>
      </div>
    </div>
  );
}