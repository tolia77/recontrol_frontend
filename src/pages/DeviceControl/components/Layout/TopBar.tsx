import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { SidebarProps, CommandAction, ScalingMode } from "src/pages/DeviceControl/types";
import type { WebRtcConnectionState } from "src/pages/DeviceControl/hooks/realtime/useWebRtc";
import { ChevronLeftIcon, ScenariosIcon, StopIcon } from "src/pages/DeviceControl/components/icons/icons";
import { FilesToggleIcon } from "src/pages/DeviceControl/components/FileManager/icons";
import { AssistantToggleIcon } from "src/pages/DeviceControl/components/Assistant/icons";
import QualityPopover from "src/pages/DeviceControl/components/Stream/QualityPopover";
import PowerPopover from "src/pages/DeviceControl/components/Power/PowerPopover";
import HeaderTransferPill from "src/pages/DeviceControl/components/Transfer/HeaderTransferPill";
import ClipboardPill from "src/pages/DeviceControl/components/Clipboard/ClipboardPill";
import type { ClipboardPillProps } from "src/pages/DeviceControl/components/Clipboard/ClipboardPill";
import type { QueueState } from "src/pages/DeviceControl/services/transfer/types";

/**
 * TopBarProps mirrors the old `ExtendedSidebarProps` 1:1 (renamed) — no new
 * props. The component decides how to spread them across the three zones.
 */
export interface TopBarProps extends SidebarProps {
  addAction?: (action: CommandAction) => void;
  onStartStream?: () => void;
  onStopStream?: () => void;
  connectionState?: WebRtcConnectionState;
  showStats?: boolean;
  onToggleStats?: () => void;
  scalingMode?: ScalingMode;
  onToggleScaling?: () => void;
  currentFps?: number;
  onFpsChange?: (fps: number) => void;
  currentResolution?: number;
  onResolutionChange?: (resolution: number) => void;
  deviceName?: string;
  transferSnapshot?: QueueState;
  onOpenPanel?: () => void;
  clipboardPill?: ClipboardPillProps;
}

// Shortcut hints are notation, not translatable copy. Kept as consts (not JSX
// string literals / attributes) so they don't read as untranslated UI strings.
const FILES_HINT = "Ctrl+Shift+F";
const ASSISTANT_HINT = "Ctrl+Shift+A";
const SCENARIOS_HINT = "Ctrl+Shift+S";

function PanelTab({
  active,
  onClick,
  icon,
  label,
  hint,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      data-testid={testId}
      className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-body font-medium transition-colors duration-150 ${
        active
          ? "bg-primary/10 text-foreground ring-primary/30 ring-1"
          : "text-muted-foreground hover:text-foreground hover:bg-primary/8"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className="text-muted-foreground/70 hidden text-[10px] font-normal lg:inline">
        {hint}
      </span>
    </button>
  );
}

function TopBar({
  activeMode,
  setActiveMode,
  addAction,
  permissions,
  disabled,
  onStartStream,
  onStopStream,
  connectionState,
  showStats,
  onToggleStats,
  scalingMode,
  onToggleScaling,
  currentFps,
  onFpsChange,
  currentResolution,
  onResolutionChange,
  deviceName,
  onTogglePanel,
  panelOpen,
  onToggleAiPanel,
  aiPanelOpen,
  onToggleScenarios,
  scenariosPanelOpen,
  transferSnapshot,
  onOpenPanel,
  clipboardPill,
}: TopBarProps) {
  const { t } = useTranslation("deviceControl");
  const { t: tAssistant } = useTranslation("assistant");
  const { t: tScenarios } = useTranslation("scenarios");
  const navigate = useNavigate();

  const isStreamActive =
    connectionState === "connected" ||
    connectionState === "connecting" ||
    connectionState === "reconnecting";
  const isStreamBusy =
    connectionState === "connecting" || connectionState === "reconnecting";
  const webRtcUp = connectionState === "connected";

  const dotColor = webRtcUp
    ? "bg-success"
    : isStreamBusy
      ? "bg-warning"
      : "bg-destructive";

  return (
    <header className="border-border bg-surface flex h-[52px] shrink-0 items-center gap-3 border-b px-3">
      {/* LEFT — Identity */}
      <button
        type="button"
        onClick={() => navigate("/devices")}
        aria-label={t("sidebar.control")}
        className="text-muted-foreground hover:text-foreground hover:bg-primary/8 rounded-md p-1.5 transition-colors duration-150"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>

      <div
        className="border-border bg-surface flex items-center gap-2 rounded-full border px-3 py-1"
        title={deviceName || t("topbar.deviceLabel")}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`}
          aria-hidden="true"
        />
        <span className="text-foreground max-w-[12rem] truncate text-body font-medium">
          {deviceName || t("topbar.deviceLabel")}
        </span>
      </div>

      {/* Clipboard pill — rendered next to the device chip while WebRTC is up.
          The wrapper neutralizes the component's sidebar-oriented mt-2/w-full
          so it sits inline in the bar. */}
      {clipboardPill && webRtcUp && (
        <div className="[&_button]:!mt-0 [&_button]:!w-auto">
          <ClipboardPill {...clipboardPill} />
        </div>
      )}
      {!panelOpen && transferSnapshot && (
        <div className="[&_button]:!mt-0 [&_button]:!w-auto">
          <HeaderTransferPill
            snapshot={transferSnapshot}
            onClick={() => (onOpenPanel ? onOpenPanel() : onTogglePanel?.())}
          />
        </div>
      )}

      {/* CENTER — Workspace */}
      <div className="bg-primary/10 flex h-8 items-center rounded-md p-0.5">
        <button
          type="button"
          onClick={() => setActiveMode("interactive")}
          className={`h-7 rounded-sm px-3 text-body font-medium transition-colors duration-150 ${
            activeMode === "interactive"
              ? "text-primary bg-surface"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("sidebar.interactive")}
        </button>
        <button
          type="button"
          onClick={() => setActiveMode("manual")}
          className={`h-7 rounded-sm px-3 text-body font-medium transition-colors duration-150 ${
            activeMode === "manual"
              ? "text-foreground bg-surface"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("sidebar.manual")}
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {onTogglePanel && (
          <PanelTab
            active={!!panelOpen}
            onClick={onTogglePanel}
            icon={<FilesToggleIcon className="h-4 w-4" />}
            label={t("topbar.files")}
            hint={FILES_HINT}
          />
        )}
        {onToggleAiPanel && (
          <PanelTab
            active={!!aiPanelOpen}
            onClick={onToggleAiPanel}
            icon={<AssistantToggleIcon className="h-4 w-4" />}
            label={tAssistant("sidebar.toggle", { defaultValue: "Assistant" })}
            hint={ASSISTANT_HINT}
          />
        )}
        {onToggleScenarios && (
          <PanelTab
            active={!!scenariosPanelOpen}
            onClick={onToggleScenarios}
            icon={<ScenariosIcon className="h-4 w-4" />}
            label={tScenarios("sidebar.toggle", { defaultValue: "Scenarios" })}
            hint={SCENARIOS_HINT}
            testId="sidebar-toggle-scenarios"
          />
        )}
      </div>

      {/* RIGHT — System */}
      <div className="ml-auto flex items-center gap-2">
        {permissions?.see_screen &&
          webRtcUp &&
          currentResolution != null &&
          currentFps != null &&
          onResolutionChange &&
          onFpsChange &&
          onToggleStats && (
            <QualityPopover
              currentResolution={currentResolution}
              onResolutionChange={onResolutionChange}
              currentFps={currentFps}
              onFpsChange={onFpsChange}
              showStats={!!showStats}
              onToggleStats={onToggleStats}
              scalingMode={scalingMode ?? "fit"}
              onToggleScaling={onToggleScaling ?? (() => {})}
              disabled={disabled}
            />
          )}

        {permissions?.manage_power && (
          <PowerPopover addAction={addAction} disabled={disabled} />
        )}

        {permissions?.see_screen &&
          (isStreamActive ? (
            <button
              type="button"
              disabled={disabled || isStreamBusy}
              onClick={() => onStopStream?.()}
              className="flex items-center gap-1.5 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-body font-medium text-destructive transition-colors duration-150 hover:border-destructive/30 hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <StopIcon className="h-3.5 w-3.5" />
              <span>
                {isStreamBusy
                  ? t("manual.quick.connecting")
                  : t("manual.quick.stopStream")}
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onStartStream?.()}
              className="bg-primary hover:bg-primary-hover disabled:bg-border disabled:text-muted-foreground rounded-md px-3 py-1.5 text-body font-medium text-white transition-colors duration-150 disabled:cursor-not-allowed"
            >
              {t("manual.quick.startStream")}
            </button>
          ))}
      </div>
    </header>
  );
}

export default TopBar;
