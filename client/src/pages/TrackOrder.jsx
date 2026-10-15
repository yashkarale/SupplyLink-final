import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchPublicOrderStatus } from "../services/api";

export default function TrackOrder() {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const response = await fetchPublicOrderStatus(token);
        if (mounted) {
          setOrder(response.order);
          setError("");
        }
      } catch (requestError) {
        if (mounted) setError(requestError?.response?.data?.message || "Unable to load this tracking link.");
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-[#f6f3ee] px-5 py-12 text-[#173421]">
      <section className="mx-auto max-w-2xl rounded-3xl border border-[#e5eee6] bg-white p-6 shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#78917c]">SUPPLY LINK ORDER</p>
        <h1 className="mt-2 text-3xl font-black">Order status</h1>
        {error && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
        {!order && !error && <p className="mt-5 text-sm text-[#667266]">Loading order status…</p>}
        {order && <>
          <p className="mt-3 text-sm text-[#667266]">Reference: {order.reference}</p>
          <div className="mt-6 rounded-2xl bg-[#edf6ee] p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#607166]">Current status</p>
            <p className="mt-1 text-2xl font-black">{order.status}</p>
          </div>
          <h2 className="mt-7 text-sm font-bold">Items</h2>
          <ul className="mt-2 divide-y divide-[#edf0eb]">
            {order.items.map((item, index) => <li key={`${item.name}-${index}`} className="flex justify-between py-3 text-sm"><span>{item.name}</span><span>× {item.quantity}</span></li>)}
          </ul>
          <h2 className="mt-7 text-sm font-bold">Status history</h2>
          <ol className="mt-3 space-y-3">
            {order.history.map((entry, index) => <li key={`${entry.to}-${entry.changedAt}-${index}`} className="flex items-start justify-between gap-4 text-sm"><span className="font-semibold">{entry.to}</span><time className="text-right text-xs text-[#78877c]">{new Date(entry.changedAt).toLocaleString()}</time></li>)}
          </ol>
        </>}
        <Link to="/" className="mt-8 inline-block text-sm font-semibold text-[#235939] hover:underline">Return to Supply Link</Link>
      </section>
    </main>
  );
}
