import { useState } from "react";
import { Outlet } from "react-router";
import Sidebar from "src/components/Sidebar";

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="w-full min-w-0 flex-1 md:ml-[220px]">
        {/* Mobile top bar */}
        <div className="bg-primary flex h-14 items-center justify-between px-3 text-white md:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
            className="p-2"
          >
            <span className="mb-[5px] block h-[2px] w-6 bg-white" />
            <span className="mb-[5px] block h-[2px] w-6 bg-white" />
            <span className="block h-[2px] w-6 bg-white" />
          </button>
        </div>

        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
