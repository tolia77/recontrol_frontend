import React from 'react';
import {Link} from "react-router";
import logo from "src/assets/img/logo-full-white-text.svg"
import dashboardIcon from "src/assets/img/icons/material-symbols_dashboard-outline-rounded.svg"

function Sidebar() {
    return (
        <aside className="w-[220px] h-full min-h-screen bg-primary">
            <Link to={"/dashboard"}>
                <img src={logo} alt="Logo" className="ml-[20px] pt-[10px] w-[160px] object-cover"/>
            </Link>
            <nav className="space-y-[5px] text-white pl-[10px] mt-[30px]">
                <Link to={"/dashboard"} className="flex gap-1">
                    <img src={dashboardIcon} alt="Dashboard" />
                    <p>Dashboard</p>
                </Link>
            </nav>
        </aside>
    );
}

export default Sidebar;
