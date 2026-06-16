import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ToastProvider from "./components/ui/Toast";
import SubscriptionProvider from "./contexts/SubscriptionContext";
import "./index.css";
// Phase 20: streamdown ships its own stylesheet (code-block / table polish).
// streamdown carries a hard mermaid dependency (~75MB on disk, larger bundle
// footprint); if dist regression exceeds ~200KB, trim per streamdown.ai docs.
// S-02c: this static CSS import keeps streamdown in the main bundle; moving it
// to the lazy AssistantPanel subtree (S-02c) will eliminate it from the initial chunk.
import "streamdown/styles.css";
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
