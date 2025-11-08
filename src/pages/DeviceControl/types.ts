export type Mode = 'interactive' | 'manual';
export type AccordionSection = 'power' | 'terminal' | 'processes';

export interface IconProps {
    className?: string;
}

export interface AccordionItemProps {
    title: string;
    isOpen: boolean;
    onClick: () => void;
}

export interface SidebarProps {
    activeMode: Mode;
    setActiveMode: (mode: Mode) => void;
    openAccordion: AccordionSection | null;
    setOpenAccordion: (item: AccordionSection | null) => void;
}

// Command action contract used for sending backend commands
export interface CommandAction {
    id: string;
    type: string;
    payload: Record<string, unknown>;
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

export interface MainContentProps {
    disabled: boolean;
    addAction: (action: CommandAction) => void;
    frames?: FrameBatch[]; // stream of region batches
    terminalResults?: { id: string; status: string; result: string }[]; // recent terminal command outputs
    processes?: ProcessInfo[];
    processesLoading?: boolean;
    requestListProcesses?: () => void;
    killProcess?: (pid: number) => void;
}
