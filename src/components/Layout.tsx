import React from 'react';
import {Outlet} from "react-router";
import Sidebar from "src/components/Sidebar.tsx";

function Layout() {
    return (
        <div className="flex min-h-screen">
            <Sidebar/>
            <main>
                <Outlet/>
            </main>
        </div>
    );
}

export default Layout;