import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bot, RefreshCw, Sparkles } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { fetchAiInsights } from "../services/api";

const paper = "border-[#e2dccf] bg-[#fffdf9] text-[#1c1a17]";
const muted = "text-[#6f685d]";
const summaryFields = [
  ["Demand forecast", "forecast"],
  ["Inventory health", "inventoryHealth"],
  ["Customer pulse", "customerPulse"],
];
const display = (value) => typeof value === "string" || typeof value === "number" ? String(value) : "Unavailable";

export default function AIInsights() {
  const { theme = "light" } = useOutletContext() || {};
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = true) => {
    if (refresh) {
      setLoading(true);
      setError("");
    }
    try {
      const result = await fetchAiInsights();
      setReport(result && typeof result === "object" ? result : null);
    } catch (err) {
      setError(err?.message || "Insights could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { Promise.resolve().then(() => load(false)); }, [load]);

  const modules = Array.isArray(report?.modules) ? report.modules : [];
  const connected = report?.connected === true;

  return <div className="space-y-6">
      <PageHeader title="AI Insights" description="Review suggestions returned by the configured insights service. These are AI-generated and should be considered alongside your recorded business data." theme={theme}>
      <button type="button" onClick={() => load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 border border-[#e2dccf] bg-[#fffdf9] px-3 text-sm font-semibold text-[#1c1a17] transition-colors hover:bg-[#f2ede3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d98a1f] disabled:cursor-wait disabled:opacity-60">
        <RefreshCw size={15} aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : ""} />{loading ? "Refreshing" : "Refresh"}
      </button>
    </PageHeader>

    {error && <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 border p-4 text-sm ${paper}`}><span className={muted}>{error}</span><button type="button" onClick={() => load()} className="font-semibold text-[#8f550b] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d98a1f]">Retry</button></div>}

    <section className={`border p-4 sm:p-5 ${paper}`} aria-labelledby="insight-status-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3"><div className="grid size-10 shrink-0 place-items-center border border-[#e2dccf] bg-[#f7f4ee] text-[#a86a16]"><Bot size={19} aria-hidden="true" /></div><div className="min-w-0"><h2 id="insight-status-heading" className="font-[Fraunces] text-lg">Insights service</h2><p className={`mt-1 text-sm ${muted}`} role="status">{loading ? "Checking service status…" : error ? "The request failed." : connected ? "Connected" : "Not connected or unavailable"}</p></div></div>
        <span className={`border px-2 py-1 text-xs font-semibold ${connected ? "border-[#b8c9a9] bg-[#f0f5eb] text-[#3d5d2b]" : "border-[#e2dccf] bg-[#f7f4ee] text-[#6f685d]"}`}>{connected ? "Connected" : loading ? "Checking" : "Unavailable"}</span>
      </div>
      {!loading && !connected && !error && <p className={`mt-4 border-t border-[#e2dccf] pt-3 text-sm leading-relaxed ${muted}`}>No live insight report was returned. Configure <code className="break-all bg-[#f7f4ee] px-1 py-0.5 font-mono text-xs">VITE_ML_URL</code> and make the insights endpoint available to receive results.</p>}
    </section>

    <section aria-labelledby="summary-heading">
      <div className="mb-3 flex items-center gap-2"><Sparkles size={16} aria-hidden="true" className="text-[#a86a16]" /><h2 id="summary-heading" className="font-[Fraunces] text-xl">Summary signals</h2></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryFields.map(([label, field]) => <article key={field} className={`min-w-0 border p-4 ${paper}`}><h3 className={`text-xs font-semibold ${muted}`}>{label}</h3><p className="mt-2 break-words text-sm font-medium">{loading ? "Loading…" : display(report?.summary?.[field])}</p></article>)}
      </div>
    </section>

    <section aria-labelledby="returned-insights-heading">
      <h2 id="returned-insights-heading" className="mb-3 font-[Fraunces] text-xl">Returned insights</h2>
      {loading ? <div className={`border p-5 text-sm ${paper} ${muted}`} role="status">Loading returned insights…</div>
        : error ? <div className={`border p-5 text-sm ${paper} ${muted}`}>Insights are unavailable until the request succeeds.</div>
          : modules.length === 0 ? <div className={`border p-5 text-sm leading-relaxed ${paper} ${muted}`}>{connected ? "The service is connected, but it returned no insight modules." : "There are no live insight recommendations to display."}</div>
            : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{modules.map((module, index) => {
              const title = [module?.title, module?.name, module?.label].find((value) => typeof value === "string" && value.trim()) || `Insight ${index + 1}`;
              const insight = typeof module?.insight === "string" ? module.insight : "No text insight was included in this result.";
              const score = Number.isFinite(Number(module?.score)) && module?.score !== null && module?.score !== "" ? module.score : null;
              return <article key={`${title}-${index}`} className={`min-w-0 border p-4 sm:p-5 ${paper}`}>
                <h3 className="break-words font-[Fraunces] text-lg">{title}</h3>
                {score !== null && <p className={`mt-2 text-xs ${muted}`}>Signal score: <span className="font-semibold text-[#1c1a17]">{String(score)}/100</span></p>}
                <p className="mt-3 break-words text-sm leading-relaxed">{insight}</p>
                {typeof module?.trend === "string" && module.trend.trim() && <p className={`mt-3 border-t border-[#e2dccf] pt-3 text-xs ${muted}`}>Reported trend: <span className="font-semibold text-[#1c1a17]">{module.trend}</span></p>}
              </article>;
            })}</div>}
      <p className={`mt-3 text-xs leading-relaxed ${muted}`}>Recommendations and scores shown here come from the insights service. They are AI-generated and are not independently verified business measurements.</p>
    </section>
  </div>;
}
