import { createRoot } from "react-dom/client";
import "./index.css";
// S-02c: streamdown/styles.css moved to AssistantPanel.tsx (lazy chunk) so the
// mermaid-adjacent CSS loads only when the AI panel is first opened.
import App from "./App";
import "./i18n";

createRoot(document.getElementById("root")!).render(
    <App />
);
