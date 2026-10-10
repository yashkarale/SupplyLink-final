
import { Plus } from "lucide-react";
import { useOutletContext } from "react-router-dom";

export default function PageHeader({ title, description, action, onAction, icon: Icon = Plus }) {
  const { theme = "light" } = useOutletContext?.() || {};
  const isDark = theme === "dark";

  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className={`text-2xl font-bold tracking-tight sm:text-[28px] ${isDark ? "text-[#edf5ee]" : "text-[#17251d]"}`}>{title}</h1>
        <p className={`mt-1.5 text-sm ${isDark ? "text-[#b2c5b7]" : "text-[#7b877e]"}`}>{description}</p>
      </div>
      {action && (
        <button onClick={onAction} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#215c39] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#18482b]">
          <Icon size={17} />
          {action}
        </button>
      )}
    </div>
  );
}