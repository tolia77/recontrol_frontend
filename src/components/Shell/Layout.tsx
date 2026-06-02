import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import { useMobileDetect } from "src/hooks/useMobileDetect";
import SubscriptionProvider from "src/contexts/SubscriptionContext";
import PastDueBanner from "src/pages/Subscription/components/PastDueBanner";
import { setPlanLimitHandler } from "src/utils/planLimitBus";
import { useToast } from "src/components/ui/Toast";

function LayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation("subscription");
  const { warning } = useToast();
  const isMobile = useMobileDetect();

  useEffect(() => {
    setPlanLimitHandler((envelope) => {
      warning(t("nudge.toast", { limitName: envelope.limit_name }));
    });
    return () => setPlanLimitHandler(null);
  }, [warning, t]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isMobile={isMobile} />

      <main className="w-full min-w-0 flex-1 md:ml-[220px]">
        {/* Mobile top bar */}
        {isMobile && (
          <div className="bg-primary flex h-14 items-center justify-between px-3 text-white">
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
        )}

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
