
import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, ExternalLink } from "lucide-react";
import { slugify, getStoreUrl } from "../utils/slugify";

export default function StoreLinkSetup() {
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");

  const handleShopNameChange = (value) => {
    setShopName(value);
    setSlug(slugify(value));
  };

  const storeUrl = getStoreUrl(slug);

  const copyLink = async () => {
    if (storeUrl) {
      await navigator.clipboard.writeText(storeUrl);
    }
  };

  return (
    <section className="rounded-2xl border border-[#e9ede7] bg-white p-6">
      <h2 className="text-lg font-bold text-[#26372b]">
        Your online store
      </h2>
      <p className="mt-1 text-sm text-[#879187]">
        Your store link updates as you enter your business name.
      </p>

      <label className="mt-6 block text-sm font-medium text-[#354238]">
        Shop name
        <input
          value={shopName}
          onChange={(e) => handleShopNameChange(e.target.value)}
          placeholder="e.g. Yash Clothing"
          className="mt-2 w-full rounded-xl border border-[#e1e8df] px-4 py-3 outline-none focus:border-[#659873]"
        />
      </label>

      <div className="mt-5 rounded-xl bg-[#f4f8f2] p-4">
        <p className="text-xs text-[#879187]">Your store URL</p>
        <p className="mt-2 break-all text-sm font-semibold text-[#27633b]">
          {storeUrl || "Your link will appear here"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!slug}
          onClick={copyLink}
          className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8de] px-4 py-3 text-sm font-semibold text-[#315c3b] disabled:opacity-40"
        >
          <Copy size={16} />
          Copy link
        </button>

        <Link
          to={slug ? `/store/${slug}?preview=true` : "#"}
          onClick={(e) => {
            if (!slug) e.preventDefault();
          }}
          className={`inline-flex items-center gap-2 rounded-xl bg-[#215c39] px-4 py-3 text-sm font-semibold text-white ${!slug ? "pointer-events-none opacity-40" : ""}`}
        >
          <ExternalLink size={16} />
          Preview store
        </Link>
      </div>
    </section>
  );
}