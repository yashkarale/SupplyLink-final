
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Bot, BrainCircuit, RefreshCw, Sparkles, TrendingUp, WandSparkles } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { fetchAiInsights } from "../services/api";

const insightCards = [
  { title: "Demand forecasting", tag: "FORECASTING", icon: TrendingUp, color: "bg-emerald-50 text-emerald-700", heading: "Plan stock for your best sellers", description: "Forecast sales based on historical demand, campaign lifts, and seasonality to protect revenue." },
  { title: "Inventory optimization", tag: "INVENTORY ML", icon: AlertTriangle, color: "bg-amber-50 text-amber-700", heading: "Reduce stockout risk", description: "Combine sales velocity, supplier lead times, and stock thresholds into reorder recommendations." },
  { title: "Customer segmentation", tag: "CUSTOMER ML", icon: BrainCircuit, color: "bg-violet-50 text-violet-700", heading: "Identify your highest-value customers", description: "Group buyers by spend and repeat order activity to personalize growth strategy." },
  { title: "Sales anomaly detection", tag: "ANOMALY DETECTION", icon: Sparkles, color: "bg-blue-50 text-blue-700", heading: "Spot unusual changes in sales", description: "Flag sudden demand shifts or stock issues before they affect the business." },
];

export default function AIInsights() {
  const [selected, setSelected] = useState(null);
  const [refreshed, setRefreshed] = useState(false);
  const [report, setReport] = useState({
    summary: {
      forecast: "Unavailable",
      inventoryHealth: "Unavailable",
      customerPulse: "Unavailable",
    },
    modules: [],
    connected: false,
  });

  useEffect(() => {
    const loadInsights = async () => {
      const nextReport = await fetchAiInsights();
      setReport(nextReport);
    };

    loadInsights();
  }, [refreshed]);

  return (
    <div>
      <PageHeader title="AI Insights" description="Turn your store's data into actionable business decisions." />
      <div className="mb-6 overflow-hidden rounded-2xl bg-[#1e4930] p-6 text-white sm:p-8 premium-panel">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-[#d6eed9]"><WandSparkles size={13} /> SUPPLY LINK INTELLIGENCE</div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Make better decisions with data.</h2>
            <p className="mt-3 text-sm leading-6 text-[#c6d9c9]">Live demand and customer signals appear here when the ML service is connected. No sample analytics are shown.</p>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center self-start rounded-3xl border border-white/10 bg-white/10 sm:self-center"><Bot size={40} strokeWidth={1.4} /></div>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#d6eed9]">Forecast</p>
            <p className="mt-2 text-lg font-bold">{report.summary.forecast}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#d6eed9]">Inventory</p>
            <p className="mt-2 text-lg font-bold">{report.summary.inventoryHealth}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#d6eed9]">Customer pulse</p>
            <p className="mt-2 text-lg font-bold">{report.summary.customerPulse}</p>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-5">
          <p className="text-xs text-[#c6d9c9]">AI services: {report.connected ? "connected" : "not connected"}</p>
          <button onClick={() => { setRefreshed((v) => !v); setSelected(null); }} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#225235] hover:bg-[#edf6ee] transition"><RefreshCw size={14} className={refreshed ? "animate-spin" : ""} /> {refreshed ? "Insights refreshed" : "Refresh insights"}</button>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2"><Sparkles size={17} className="text-[#4c865a]" /><h2 className="text-sm font-bold text-[#26372b]">Intelligence modules</h2></div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {insightCards.map(({ title, tag, icon: Icon, color, heading, description }, index) => {
          const module = report.modules[index] || { score: null, insight: "No live model output available.", trend: null };
          return (
            <div key={title} className="rounded-2xl border border-[#e9ede7] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#1b3921]/5 premium-card">
              <div className="mb-5 flex items-start justify-between gap-3"><div className={`rounded-xl p-3 ${color}`}><Icon size={21} /></div><span className="rounded-lg bg-[#f5f7f4] px-2.5 py-1.5 text-[9px] font-bold tracking-wider text-[#7c887d]">{tag}</span></div>
              <h3 className="text-base font-bold text-[#26372b]">{title}</h3>
              <p className="mt-3 text-sm font-semibold text-[#4d6651]">{heading}</p>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f9faf8] px-3 py-2 text-xs text-[#4d6651]">
                <span>Signal score</span>
                <span className="font-bold">{module.score == null ? "—" : `${module.score}/100`}</span>
              </div>
              <p className="mt-3 text-xs leading-6 text-[#89948a]">{description}</p>
              <div className="mt-4 flex items-center justify-between text-[11px] text-[#38724b]">
                <span>{module.insight}</span>
                {module.trend && <span className="font-bold">{module.trend}</span>}
              </div>
              <button onClick={() => setSelected(selected === title ? null : title)} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#327348] hover:text-[#18482b] transition">{selected === title ? "Hide implementation plan" : "View implementation plan"} <ArrowRight size={14} /></button>
              {selected === title && <div className="mt-4 rounded-xl border border-[#e5ede3] bg-[#f7faf6] p-4"><p className="text-xs font-bold text-[#385d40]">Implementation plan</p><p className="mt-2 text-xs leading-5 text-[#758477]">Collect tenant-scoped historical records, define a measurable baseline, build and validate the algorithm, expose it through a protected API endpoint, and present the result with confidence and business context.</p></div>}
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-[10px] text-[#9aa49b]">Configure VITE_ML_URL and connect the ML service to display live insights.</p>
    </div>
  );
}
