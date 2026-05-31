import { useEffect, useState } from "react";
import type { QueueState } from "src/pages/DeviceControl/services/transfer/types";
import type { TransferQueue } from "src/pages/DeviceControl/services/transfer/TransferQueue";

/**
 * Subscribe a React component to a {@link TransferQueue} instance.
 *
 * The hook does NOT own the queue -- ownership lives in the panel-level
 * component (FileManagerPanel) which constructs the queue once via useRef and
 * passes it in. This separation lets the same queue survive a re-render of
 * the panel without rebuilding listeners or losing in-flight state.
 *
 * Returns the latest snapshot. The component re-renders on every snapshot
 * push from the queue; React's reference-equality on the items array (a fresh
 * shallow copy each tick) makes useState bail-outs unnecessary -- every
 * `notify()` produces a new array identity.
 */
export function useTransferQueue(queue: TransferQueue): QueueState {
  const [snapshot, setSnapshot] = useState<QueueState>(() =>
    queue.getSnapshot(),
  );
  useEffect(() => {
    // subscribe pushes the current snapshot synchronously, so the very first
    // useState initializer above and the first cb invocation here will land
    // on the same value (no extra render).
    return queue.subscribe(setSnapshot);
  }, [queue]);
  return snapshot;
}
