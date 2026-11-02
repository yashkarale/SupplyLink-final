import { Link } from "react-router-dom";

export default function CustomerFooter() {
  return (
    <footer className="mt-12 border-t border-line bg-[#f4efe8]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <Link to="/marketplace" className="font-[Fraunces] text-lg font-semibold text-[#17151a]">Supply Link</Link>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[#6f685d]">Discover independent shops and products around your community. Guest checkout is available; keep the private tracking link provided after placing an order.</p>
        </div>
        <nav aria-label="Marketplace footer" className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#514b43]">
          <Link to="/marketplace">Discover products</Link>
          <Link to="/shops">Browse shops</Link>
          <Link to="/sell">For sellers</Link>
        </nav>
      </div>
    </footer>
  );
}
