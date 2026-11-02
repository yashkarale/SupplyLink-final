import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, CalendarRange } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { fetchPosSales } from "../services/api";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

export default function SalesHistory() {
  const { theme = "light" } = useOutletContext() || {};
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("All");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    let active = true;

    setLoading(true);
    fetchPosSales({ page, limit: 25, search: search.trim() || undefined, paymentMethod: paymentMethod === "All" ? undefined : paymentMethod, status: status === "All" ? undefined : status, fromDate: fromDate || undefined, toDate: toDate ? `${toDate}T23:59:59.999` : undefined })
      .then((response) => {
        if (!active) return;
        setSales(Array.isArray(response?.sales) ? response.sales : []);
        setPagination(response?.pagination || { page, totalPages: response?.totalPages || 1, total: response?.total || 0 });
      })
      .catch((err) => {
        if (!active) return;
        setErrorMessage(err?.response?.data?.message || err?.message || "Unable to load sales history.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, search, paymentMethod, status, fromDate, toDate]);

  const filteredSales = sales;

  return (
    <main className="min-w-0 space-y-5 text-[var(--ink)]">
      <PageHeader
        title="Sales History"
        description="Review walk-in sales, payment methods, and product-level totals recorded from your POS counter."
        theme={theme}
      />

      <section className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3">
            <Search size={16} className="text-[var(--muted)]" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search sale reference or product"
              className="h-10 w-full bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setPage(1); }} className="h-10 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)] outline-none">
              <option value="All">All payment methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)] outline-none">
              <option value="All">All statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3"><label className="text-xs text-[var(--muted)]">From <input aria-label="Sales from date" type="date" value={fromDate} onChange={(event)=>{setFromDate(event.target.value);setPage(1);}} className="ml-2 h-10 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-2 text-sm" /></label><label className="text-xs text-[var(--muted)]">To <input aria-label="Sales to date" type="date" value={toDate} onChange={(event)=>{setToDate(event.target.value);setPage(1);}} className="ml-2 h-10 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-2 text-sm" /></label><span className="self-center text-xs text-[var(--muted)]">{pagination.total} POS sales</span></div>

        {errorMessage && (
          <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-3 text-sm text-[var(--danger)]">
            {errorMessage}
          </div>
        )}
      </section>
      {!loading && pagination.totalPages > 1 && <div className="flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-3"><button type="button" disabled={page<=1} onClick={()=>setPage((value)=>value-1)} className="min-h-10 px-2 text-sm disabled:opacity-40">Previous</button><span className="text-xs text-[var(--muted)]">Page {page} of {pagination.totalPages}</span><button type="button" disabled={page>=pagination.totalPages} onClick={()=>setPage((value)=>value+1)} className="min-h-10 px-2 text-sm disabled:opacity-40">Next</button></div>}

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]">
        {loading ? (
          <div className="space-y-4 p-5">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-[var(--radius-control)] bg-[var(--paper)]" />
            ))}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-6 text-sm text-[var(--muted)]">No offline sales match the current filters.</div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {filteredSales.map((sale) => (
              <article key={sale._id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--ink)]">{sale.orderReference}</span>
                      <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{sale.orderStatus}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                      <CalendarRange size={14} />
                      <span>{formatDate(sale.createdAt)}</span>
                    </div>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-lg font-bold text-[var(--ink)]">{currency.format(sale.totalAmount)}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{sale.paymentMethod}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {Array.isArray(sale.items) && sale.items.map((item) => (
                    <div key={`${sale._id}-${item.productId}`} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-[var(--ink)]">{item.name}</p>
                        <p className="text-[var(--muted)]">Qty {item.quantity}</p>
                      </div>
                      <span className="font-semibold text-[var(--ink)]">{currency.format(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
