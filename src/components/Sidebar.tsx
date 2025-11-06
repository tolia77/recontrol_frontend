import React from 'react';
import {Link} from "react-router";
import logo from "src/assets/img/logo-full-white-text.svg"
import dashboardIcon from "src/assets/img/icons/dashboard.svg"
import devicesIcon from "src/assets/img/icons/device.svg"

type SidebarProps = {
    isOpen?: boolean;
    onClose?: () => void;
};

function Sidebar({ isOpen = false, onClose }: SidebarProps) {
    const NavContent = (
        <>
            <Link to={"/dashboard"}>
                <img src={logo} alt="Logo" className="ml-[10px] pt-[10px] h-[70px] object-cover"/>
            </Link>
            <nav className="space-y-[5px] text-white pl-[10px] mt-[30px]">
                <Link to={"/dashboard"} className="flex gap-1 h-[45px] items-center">
                    <img src={dashboardIcon} alt="Dashboard" />
                    <p>Dashboard</p>
                </Link>
                <Link to={"/devices"} className="flex gap-1 h-[45px] items-center">
                    <img src={devicesIcon} alt="Devices" />
                    <p>Devices</p>
                </Link>
            </nav>
        </>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="hidden md:block w-[220px] h-full min-h-screen bg-primary">
                {NavContent}
            </aside>

            {/* Mobile drawer */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close menu backdrop" />
                    <aside className="relative h-full w-[220px] bg-primary shadow-xl">
                        <div className="flex items-center justify-end p-2">
                            <button
                                type="button"
                                aria-label="Close menu"
                                onClick={onClose}
                                className="text-white p-2"
                            >
                                ✕
                            </button>
                        </div>
                        {NavContent}
                    </aside>
                </div>
            )}
        </>
    );
}

export default Sidebar;
