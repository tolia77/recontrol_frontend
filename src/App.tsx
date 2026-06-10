import { BrowserRouter, Route, Routes } from "react-router";
import Layout from "src/components/Shell/Layout";
import Index from "src/pages/Index";
import Pricing from "src/pages/Pricing";
import Login from "src/pages/Login";
import Signup from "src/pages/Signup";
import DeviceControl from "src/pages/DeviceControl/DeviceControl";
import SubscriptionProvider from "src/contexts/SubscriptionContext";
import Dashboard from "src/pages/Dashboard";
import Devices from "src/pages/Devices/Devices";
import Scenarios from "src/pages/Scenarios/Scenarios";
import DeviceSettings from "src/pages/DeviceSettings/DeviceSettings";
import Help from "src/pages/Help";
import UserSettings from "src/pages/UserSettings";
import AdminUsers from "src/pages/AdminUsers/AdminUsers";
import AdminSubscriptions from "src/pages/AdminSubscriptions/AdminSubscriptions";
import AdminDevices from "src/pages/AdminDevices/AdminDevices";
import AdminAiUsage from "src/pages/AdminAiUsage/AdminAiUsage";
import ManageSubscription from "src/pages/Subscription/ManageSubscription";
import SubscriptionReturn from "src/pages/Subscription/SubscriptionReturn";

function App() {
  return (
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
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
          <Route path="/admin/devices" element={<AdminDevices />} />
          <Route path="/admin/ai-usage" element={<AdminAiUsage />} />
          <Route path="/subscription" element={<ManageSubscription />} />
          <Route path="/subscription/return" element={<SubscriptionReturn />} />
        </Route>

        {/* Help page */}
        <Route path="/help" element={<Help />} />

        {/* Auth and utilities */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/device-control"
          element={
            <SubscriptionProvider>
              <DeviceControl wsUrl={import.meta.env.VITE_WEBSOCKETS_URL} />
            </SubscriptionProvider>
          }
        />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
