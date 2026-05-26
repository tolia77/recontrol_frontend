import { useEffect, useState } from "react";
import { detectCapability } from "../services/clipboard";

export interface ClipboardCapability {
  canRead: boolean;
  canWrite: boolean;
  isSecureContext: boolean;
}

/**
 * One-shot capability detect for the Async Clipboard API.
 * NEVER calls navigator.permissions.query (CONTEXT D-12 / DEGRADE-03):
 *   Firefox throws TypeError on { name: 'clipboard-read' }.
 * Capability detection is feature-presence only; permission state is
 * surfaced via the readText try/catch path in useClipboardSync.
 */
export function useClipboardCapability(): ClipboardCapability {
  const [caps, setCaps] = useState<ClipboardCapability>({
    canRead: false,
    canWrite: false,
    isSecureContext: false,
  });
  useEffect(() => {
    const isSecure =
      typeof window !== "undefined" && (window.isSecureContext ?? false);
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    setCaps(detectCapability(nav, isSecure));
  }, []);
  return caps;
}
