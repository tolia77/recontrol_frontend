import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import Layout from "src/components/Shell/Layout";
import Index from "src/pages/Index";
import Pricing from "src/pages/Pricing";
import Login from "src/pages/Login";
import Signup from "src/pages/Signup";
import Dashboard from "src/pages/Dashboard";
import Devices from "src/pages/Devices/Devices";
import Scenarios from "src/pages/Scenarios/Scenarios";
import DeviceSettings from "src/pages/DeviceSettings/DeviceSettings";
import Help from "src/pages/Help";
import UserSettings from "src/pages/UserSettings";
import ManageSubscription from "src/pages/Subscription/ManageSubscription";
import SubscriptionReturn from "src/pages/Subscription/SubscriptionReturn";
import Spinner from "src/components/ui/Spinner";
import ToastProvider from "src/components/ui/Toast";
import SubscriptionProvider from "src/contexts/SubscriptionContext";

// Admin pages lazy-loaded — non-admins never download these chunks
const AdminUsers = lazy(() => import("src/pages/AdminUsers/AdminUsers"));
const AdminSubscriptions = lazy(() => import("src/pages/AdminSubscriptions/AdminSubscriptions"));
const AdminDevices = lazy(() => import("src/pages/AdminDevices/AdminDevices"));
const AdminAiUsage = lazy(() => import("src/pages/AdminAiUsage/AdminAiUsage"));

// DeviceControl lazy-loaded — heavy page, only loaded when user navigates there
const DeviceControl = lazy(() => import("src/pages/DeviceControl/DeviceControl"));

const pageFallback = (
  <div className="flex h-full items-center justify-center">
    <Spinner />
  </div>
);

function App() {
  // SubscriptionProvider wraps the router (not a route element) so it
  // mounts once per app session and stays mounted across all routes — including
  // the standalone /device-control route, whose gates consume it. ToastProvider
  // sits outermost so toasts are available everywhere.
  return (
    <ToastProvider>
      <SubscriptionProvider>
        <BrowserRouter>
          {/* h-dvh: fills dynamic viewport height — no address-bar gap on mobile
              overflow-hidden: prevents inner wide components leaking horizontal scroll to root
              safe-pt/safe-pb/safe-pl/safe-pr applied via utility classes defined in index.css */}
          <div className="h-dvh overflow-hidden safe-pt safe-pb safe-pl safe-pr">
            <Routes>
            {/* Public landing page without sidebar */}
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<Pricing />} />

            {/* App pages with sidebar layout */}
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/scenarios" element={<Scenarios />} />
              <Route
                path="/devices/:deviceId/settings"
                element={<DeviceSettings />}
              />
              <Route path="/settings" element={<UserSettings />} />
              {/* S-02a: admin pages in lazy chunks — non-admins never download these */}
              <Route path="/admin/users" element={<Suspense fallback={pageFallback}><AdminUsers /></Suspense>} />
              <Route path="/admin/subscriptions" element={<Suspense fallback={pageFallback}><AdminSubscriptions /></Suspense>} />
              <Route path="/admin/devices" element={<Suspense fallback={pageFallback}><AdminDevices /></Suspense>} />
              <Route path="/admin/ai-usage" element={<Suspense fallback={pageFallback}><AdminAiUsage /></Suspense>} />
              <Route path="/subscription" element={<ManageSubscription />} />
              <Route path="/subscription/return" element={<SubscriptionReturn />} />
            </Route>

            {/* Help page */}
            <Route path="/help" element={<Help />} />

            {/* Auth and utilities */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            {/* S-02b: DeviceControl in a lazy chunk — heavy page, only needed on this route */}
            <Route
              path="/device-control"
              element={
                <Suspense fallback={pageFallback}>
                  <DeviceControl wsUrl={import.meta.env.VITE_WEBSOCKETS_URL} />
                </Suspense>
              }
            />
            </Routes>
          </div>
        </BrowserRouter>
      </SubscriptionProvider>
    </ToastProvider>
  );
}

export default App;
