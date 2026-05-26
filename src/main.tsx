import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "./components/ui/Toast";
import "./index.css";
// Phase 20: streamdown ships its own stylesheet (code-block / table polish).
// streamdown carries a hard mermaid dependency (~75MB on disk, larger bundle
// footprint); if dist regression exceeds ~200KB, trim per streamdown.ai docs.
import "streamdown/styles.css";
import App from "./App";
import "./i18n";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
