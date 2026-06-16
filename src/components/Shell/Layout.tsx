import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import { useMobileDetect } from "src/hooks/useMobileDetect";
import PastDueBanner from "src/pages/Subscription/components/PastDueBanner";
import { setPlanLimitHandler } from "src/utils/planLimitBus";
import { useToast } from "src/components/ui/Toast";

// Top-level destinations reachable from the sidebar nav. On these the mobile top
// bar shows the hamburger; everywhere else under Layout (e.g. device settings,
// subscription return) it shows a Back button instead.
const TOP_LEVEL_PATHS = new Set([
  "/dashboard",
  "/devices",
  "/scenarios",
  "/settings",
  "/subscription",
  "/admin/users",
  "/help",
]);

function LayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation("subscription");
  const { t: tc } = useTranslation("common");
  const { warning } = useToast();
  const isMobile = useMobileDetect();
  const location = useLocation();
  const navigate = useNavigate();
  const isNested = !TOP_LEVEL_PATHS.has(location.pathname);

  useEffect(() => {
    setPlanLimitHandler((envelope) => {
      warning(t("nudge.toast", { limitName: envelope.limit_name }));
    });
    return () => setPlanLimitHandler(null);
  }, [warning, t]);

  return (
    <div className="flex h-full">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isMobile={isMobile} />

      {/* Sidebar offset is driven by useMobileDetect (D-02/D-03), NOT the `md:`
          width breakpoint. A landscape phone is wider than 768px yet still on
          the mobile path (no fixed sidebar rendered), so a width-based
          `md:ml-[220px]` would reserve a phantom 220px gap. */}
      <main
        className={`flex h-full w-full min-w-0 flex-1 flex-col ${
          isMobile ? "" : "ml-[220px]"
        }`}
      >

        {/* Mobile top bar — fixed height; back button on nested pages, hamburger otherwise */}
        {isMobile && (
          <div className="bg-primary flex h-14 shrink-0 items-center px-3 text-white">
            {isNested ? (
              <button
                type="button"
                aria-label={tc("nav.back")}
                onClick={() => navigate(-1)}
                className="p-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
              </button>
            ) : (
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
            )}
          </div>
        )}

        {/* Scrollable content region — the app shell is h-dvh overflow-hidden, so
            this is where page content actually scrolls. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PastDueBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Layout() {
  // S-01r: SubscriptionProvider is mounted once globally in main.tsx (above the
  // router). The previous per-Layout instance was redundant — it re-fetched
  // status/usage/plans on every Layout mount and, after the lift, double-fetched
  // alongside the global provider. Removed so a single provider fetches once.
  return <LayoutInner />;
}

export default Layout;
