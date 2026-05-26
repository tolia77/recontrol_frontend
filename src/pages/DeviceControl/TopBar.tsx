import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { SidebarProps, CommandAction } from "./types";
import type { WebRtcConnectionState } from "./hooks/useWebRtc";
import { ChevronLeftIcon, ScenariosIcon, StopIcon } from "./icons";
import { FilesToggleIcon } from "./components/FileManager/icons";
import { AssistantToggleIcon } from "./components/Assistant/icons";
import { QualityPopover } from "./components/QualityPopover";
import { PowerPopover } from "./components/PowerPopover";
import { HeaderTransferPill } from "./components/HeaderTransferPill";
import { ClipboardPill } from "./components/ClipboardPill";
import type { ClipboardPillProps } from "./components/ClipboardPill";
import type { QueueState } from "./services/transfer";

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
      className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-accent/10 text-text ring-accent/30 ring-1"
          : "text-darkgray hover:text-text hover:bg-gray-100"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className="text-darkgray/70 hidden text-[10px] font-normal lg:inline">
        {hint}
      </span>
    </button>
  );
}

export function TopBar({
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
    ? "bg-accent"
    : isStreamBusy
      ? "bg-amber"
      : "bg-error";

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3">
      {/* LEFT — Identity */}
      <button
        type="button"
        onClick={() => navigate("/devices")}
        aria-label={t("sidebar.control")}
        className="text-darkgray hover:text-text rounded-lg p-1.5 transition-colors hover:bg-gray-100"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>

      <div
        className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1"
        title={deviceName || t("topbar.deviceLabel")}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`}
          aria-hidden="true"
        />
        <span className="text-text max-w-[12rem] truncate text-sm font-medium">
          {deviceName || t("topbar.deviceLabel")}
        </span>
      </div>

      {/* Phase 16: clipboard pill — rendered next to the device chip while
          WebRTC is up. v1 keeps the component unchanged; the wrapper neutralizes
          its sidebar-oriented mt-2/w-full so it sits inline in the bar. */}
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
      <div className="flex h-8 items-center rounded-lg bg-gray-100 p-0.5">
        <button
          type="button"
          onClick={() => setActiveMode("interactive")}
          className={`h-7 rounded-md px-3 text-sm font-medium transition-colors ${
            activeMode === "interactive"
              ? "text-accent bg-white shadow-sm"
              : "text-darkgray hover:text-text"
          }`}
        >
          {t("sidebar.interactive")}
        </button>
        <button
          type="button"
          onClick={() => setActiveMode("manual")}
          className={`h-7 rounded-md px-3 text-sm font-medium transition-colors ${
            activeMode === "manual"
              ? "text-text bg-white shadow-sm"
              : "text-darkgray hover:text-text"
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
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="bg-secondary hover:bg-primary disabled:bg-lightgray disabled:text-darkgray rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors disabled:cursor-not-allowed"
            >
              {t("manual.quick.startStream")}
            </button>
          ))}
      </div>
    </header>
  );
}
