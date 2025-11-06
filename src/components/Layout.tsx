import React, { useState } from 'react';
import {Outlet} from "react-router";
import Sidebar from "src/components/Sidebar.tsx";

function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="flex-1 min-w-0 w-full">
                {/* Mobile top bar */}
                <div className="md:hidden flex items-center justify-between bg-primary text-white h-14 px-3">
                    <button
                        type="button"
                        aria-label="Open menu"
                        onClick={() => setSidebarOpen(true)}
                        className="p-2"
                    >
                        <span className="block w-6 h-[2px] bg-white mb-[5px]" />
                        <span className="block w-6 h-[2px] bg-white mb-[5px]" />
                        <span className="block w-6 h-[2px] bg-white" />
                    </button>
                    {/* ...existing code... optional title/controls ...existing code... */}
                </div>
                {/* ...existing code... */}
                <Outlet/>
                {/* ...existing code... */}
            </main>
        </div>
    );
}

export default Layout;