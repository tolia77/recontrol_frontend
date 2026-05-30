import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import SubscriptionProvider from "src/contexts/SubscriptionContext";
import PastDueBanner from "src/pages/Subscription/components/PastDueBanner";
import { setPlanLimitHandler } from "src/utils/planLimitBus";
import { useToast } from "src/components/ui/Toast";

function LayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation("subscription");
  const { warning } = useToast();

  useEffect(() => {
    setPlanLimitHandler((envelope) => {
      warning(t("nudge.toast", { limitName: envelope.limit_name }));
    });
    return () => setPlanLimitHandler(null);
  }, [warning, t]);

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

        <PastDueBanner />
        <Outlet />
      </main>
    </div>
  );
}

function Layout() {
  return (
    <SubscriptionProvider>
      <LayoutInner />
    </SubscriptionProvider>
  );
}

export default Layout;
