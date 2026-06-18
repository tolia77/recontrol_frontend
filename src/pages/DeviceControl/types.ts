import type { WebRtcConnectionState } from "./hooks/realtime/useWebRtc";
import type { StreamStats } from "./hooks/realtime/useStreamStats";
import type { PermissionsSubset } from "src/types";

export type Mode = "interactive" | "manual";
export type ScalingMode = "fit" | "1:1";

export interface IconProps {
  className?: string;
}

export interface SidebarProps {
  activeMode: Mode;
  setActiveMode: (mode: Mode) => void;
  // new optional props for moving quick actions
  permissions?: PermissionsSubset;
  disabled?: boolean;
  connectionState?: WebRtcConnectionState;
  // file manager panel toggle
  onTogglePanel?: () => void;
  panelOpen?: boolean;
  // assistant panel toggle — radio group with onTogglePanel
  onToggleAiPanel?: () => void;
  aiPanelOpen?: boolean;
  // scenarios panel toggle — third radio sibling alongside files/assistant
  onToggleScenarios?: () => void;
  scenariosPanelOpen?: boolean;
}

// Command action contract used for sending backend commands
export interface CommandAction {
  id?: string;
  type: string;
  payload?: Record<string, unknown>;
}

// New region based screen streaming types
export interface FrameRegion {
  image: string; // base64 JPEG/PNG without data URL prefix
  isFull?: boolean; // true if this region represents a full frame (initial)
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameBatch {
  id: string;
  regions: FrameRegion[];
}

export interface ProcessInfo {
  Pid: number;
  Name: string;
  MemoryMB?: number;
  CpuTime?: string;
  StartTime?: string;
}

export type { PermissionsSubset };

export interface MainContentProps {
  disabled: boolean;
  addAction: (action: CommandAction) => void;
  frames?: FrameBatch[]; // stream of region batches
  terminalResults?: { id: string; status: string; result: string }[]; // recent terminal command outputs
  processes?: ProcessInfo[];
  processesLoading?: boolean;
  requestListProcesses?: () => void;
  killProcess?: (pid: number) => void;
  permissions?: PermissionsSubset;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  setVideoNode?: (node: HTMLVideoElement | null) => void;
  connectionState: WebRtcConnectionState;
  hasReceivedFrame: boolean;
  retryWebRtc: () => void;
  streamStats?: StreamStats | null;
  showStats?: boolean;
  scalingMode?: ScalingMode;
  // file manager panel
  panelOpen?: boolean;
  fileManagerNode?: React.ReactNode;
  // assistant panel — mutex with fileManagerNode
  assistantPanelNode?: React.ReactNode;
  // scenarios panel — third mutex sibling with files/assistant
  scenariosPanelNode?: React.ReactNode;
  splitRatio?: number;
  setSplitRatio?: (r: number) => void;
  /** When true, render the mobile branch (full-width stream + gesture overlay).
   * Passed from DeviceControl (single useMobileDetect call at orchestrator level);
   * MainContent MUST NOT call useMobileDetect itself. */
  isMobile?: boolean;
  /** Called when the user taps "Start stream" on mobile idle stage (36-UI-SPEC §Microcopy).
   * On desktop the idle stage is non-interactive — start lives in TopBar. */
  onStartStream?: () => void;
}
