import { createRoot } from "react-dom/client";
import "./index.css";
// streamdown/styles.css is loaded in AssistantPanel.tsx (lazy chunk) instead of
// here, so the mermaid-adjacent CSS loads only when the AI panel is first opened.
import App from "./App";
import "./i18n";

createRoot(document.getElementById("root")!).render(
    <App />
);
