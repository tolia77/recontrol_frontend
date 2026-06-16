import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ToastProvider from "./components/ui/Toast";
import SubscriptionProvider from "./contexts/SubscriptionContext";
import "./index.css";
// S-02c: streamdown/styles.css moved to AssistantPanel.tsx (lazy chunk) so the
// mermaid-adjacent CSS loads only when the AI panel is first opened.
import App from "./App";
import "./i18n";

// S-01r: SubscriptionProvider lifted above BrowserRouter so it mounts once per
// app session (not once per Layout mount). Eliminates the per-fresh-load triple
// fetch from firing again on hard-refresh into a sidebar route.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <SubscriptionProvider>
        <App />
      </SubscriptionProvider>
    </ToastProvider>
  </StrictMode>,
);
