import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Package, ArrowLeft, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { fetchPublicOrderStatus } from "../services/api";
import StatusBadge from "../components/ui/StatusBadge";

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
    <main className="min-h-screen bg-slate-50 dark:bg-[#0B1120] px-4 py-12 text-slate-800 dark:text-slate-100 transition-colors">
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 dark:border-[#29364B] bg-white dark:bg-[#151D2E] p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#29364B] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Order Tracking</p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Supply Link Delivery</h1>
            </div>
          </div>
          {order && <StatusBadge status={order.status} />}
        </div>

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {!order && !error && (
          <div className="mt-8 flex items-center justify-center gap-3 py-12 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span>Loading order status…</span>
          </div>
        )}

        {order && (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-[#29364B] bg-slate-50 dark:bg-[#1C2639] p-4 text-sm">
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Reference:</span>
                <span className="ml-2 font-mono font-bold text-slate-900 dark:text-slate-100">{order.reference}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                <span>Auto-updates every 15s</span>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Items Ordered</h2>
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-[#29364B]/60 rounded-xl border border-slate-200 dark:border-[#29364B] bg-white dark:bg-[#151D2E] px-4">
                {order.items?.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="flex items-center justify-between py-3 text-sm">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{item.name}</span>
                    <span className="rounded-md bg-slate-100 dark:bg-[#1C2639] px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      × {item.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status History</h2>
              <ol className="mt-3 space-y-3">
                {order.history?.map((entry, index) => (
                  <li
                    key={`${entry.to}-${entry.changedAt}-${index}`}
                    className="flex items-start justify-between gap-4 rounded-xl border border-slate-200/80 dark:border-[#29364B]/80 bg-slate-50/50 dark:bg-[#1C2639]/40 p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.to}</span>
                    </div>
                    <time className="text-right text-xs text-slate-500 dark:text-slate-400">
                      {new Date(entry.changedAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        <div className="mt-8 border-t border-slate-200 dark:border-[#29364B] pt-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Supply Link</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
