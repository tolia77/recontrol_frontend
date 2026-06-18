import { ClipboardLoopGate } from "./clipboardLoopGate";

export interface ClipboardChannelHandle {
  dispose: () => void;
}

export function createClipboardChannelHandle(
  dc: RTCDataChannel,
  loopGate: ClipboardLoopGate,
  log: Pick<Console, "log" | "warn"> = console,
): ClipboardChannelHandle {
  const onMessage = (ev: MessageEvent): void => {
    if (typeof ev.data !== "string") {
      log.warn("[clipboard] non-text frame dropped");
      return;
    }
    // Strict parsing happens on the desktop side; this listener stays
    // lightweight and policy-only.
    log.log("[clipboard] message received");
  };

  const onClose = (): void => {
    loopGate.reset();
    log.log("[clipboard] channel closed");
  };

  dc.addEventListener("message", onMessage);
  dc.addEventListener("close", onClose);

  return {
    dispose: () => {
      dc.removeEventListener("message", onMessage);
      dc.removeEventListener("close", onClose);
    },
  };
}
