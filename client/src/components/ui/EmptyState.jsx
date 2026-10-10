
import { PackageSearch } from "lucide-react";

export default function EmptyState({ title = "Nothing here yet", description = "Try changing your search or filters." }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-[#eef3ee] p-4 text-[#52745b]">
        <PackageSearch size={28} />
      </div>
      <h3 className="font-semibold text-[#26372b]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[#879188]">{description}</p>
    </div>
  );
}