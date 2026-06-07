import type { QueueState } from "src/pages/DeviceControl/services/transfer/types";

interface HeaderTransferPillProps {
  snapshot: QueueState;
  onClick: () => void;
}

const IN_FLIGHT_STATES = new Set(["queued", "active", "cancelling", "stalled"]);

function HeaderTransferPill({
  snapshot,
  onClick,
}: HeaderTransferPillProps) {
  const inFlight = snapshot.items.filter((item) =>
    IN_FLIGHT_STATES.has(item.state),
  );
  if (inFlight.length === 0) return null;

  const count = inFlight.length;
  const bytesSoFar = inFlight.reduce((sum, item) => sum + item.bytesSoFar, 0);
  const bytesTotal = inFlight.reduce((sum, item) => sum + item.size, 0);
  const pct =
    bytesTotal > 0
      ? Math.max(0, Math.min(100, Math.floor((bytesSoFar / bytesTotal) * 100)))
      : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-success mt-2 w-full rounded-md px-3 py-2 text-left text-body font-medium text-white transition-colors duration-150 hover:bg-success/80"
    >
      {`${count} ${count === 1 ? "transfer" : "transfers"} - ${pct}%`}
    </button>
  );
}

export default HeaderTransferPill;
