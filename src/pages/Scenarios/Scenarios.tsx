import ScenariosPanel from "src/pages/DeviceControl/components/Scenarios/ScenariosPanel";

/**
 * Standalone Scenarios page reachable from the dashboard sidebar (/scenarios).
 *
 * Reuses the existing ScenariosPanel device-less: scenarios and run history are
 * user-scoped, so the library, history, AI-drafting, and editor flows all work
 * without a connected device. Only *launching* a run needs a live device
 * connection — so the panel is hosted with `consumer={null}`, `connected={false}`
 * and `runEnabled={false}`, which disables [▶ Run] and surfaces a hint pointing
 * the operator at a device session. The panel's run-mode / policy-preview
 * machinery stays inert.
 */
function Scenarios() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-dvh">
      <ScenariosPanel deviceId="" consumer={null} connected={false} deviceName="" runEnabled={false} />
    </div>
  );
}

export default Scenarios;
