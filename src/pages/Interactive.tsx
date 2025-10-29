import React from 'react';

// --- Types ---

type Mode = 'interactive' | 'manual';
type AccordionSection = 'power' | 'terminal' | 'processes';

interface IconProps {
    className?: string;
}

interface AccordionItemProps {
    title: string;
    isOpen: boolean;
    onClick: () => void;
}

interface SidebarProps {
    activeMode: Mode;
    setActiveMode: (mode: Mode) => void;
    openAccordion: AccordionSection | null;
    setOpenAccordion: (item: AccordionSection | null) => void;
}

// --- New Types for MainContent ---
interface Frame {
    id: string;
    image: string;
}

interface Tile {
    id?: string;
    image?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

interface MainContentProps {
    disabled: boolean;
    addAction: (action: any) => void;
    frames?: Frame[];
    tiles?: Tile[];
}


// --- Icon Components ---
// Using inline SVGs for icons to keep it in one file.

/**
 * Back Arrow Icon (ChevronLeft)
 */
export const ChevronLeftIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="m15 18-6-6 6-6" />
    </svg>
);

/**
 * Accordion Arrow Icon (ChevronDown)
 */
export const ChevronDownIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="m6 9 6 6 6-6" />
    </svg>
);


// --- Reusable Accordion Component ---

/**
 * AccordionItem Component
 * @param {string} title - The text to display for the item
 * @param {boolean} isOpen - Whether the accordion item is currently open
 * @param {function} onClick - Function to call when the item is clicked
 */
export const AccordionItem: React.FC<AccordionItemProps> = ({ title, isOpen, onClick }) => {
    return (
        <div>
            <button
                onClick={onClick}
                className="flex justify-between items-center w-full text-left py-3 px-3 rounded-lg text-gray-200 hover:bg-white/10 focus:outline-none focus:bg-white/10 transition-colors duration-200"
            >
                <span className="font-medium">{title}</span>
                <ChevronDownIcon
                    className={`w-5 h-5 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>
            {/* You can add content here to show when isOpen is true */}
            {/*
      {isOpen && (
        <div className="pl-6 pt-2 pb-1 text-gray-300">
          <p>Sub-item 1</p>
          <p>Sub-item 2</p>
        </div>
      )}
      */}
        </div>
    );
};


// --- Sidebar Component ---

/**
 * Sidebar Navigation
 */
export const Sidebar: React.FC<SidebarProps> = ({ activeMode, setActiveMode, openAccordion, setOpenAccordion }) => {
    const toggleAccordion = (item: AccordionSection) => {
        setOpenAccordion(openAccordion === item ? null : item);
    };

    return (
        <div className="w-64 bg-[#1E3A8A] text-white p-6 flex flex-col h-screen fixed left-0 top-0">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-xl font-semibold text-gray-200">Interactive</h1>
                <button className="p-1 rounded-full hover:bg-white/10">
                    <ChevronLeftIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Mode Toggle */}
            <div className="mb-8">
                <label className="text-xs text-[#8F8F8F] uppercase font-bold mb-2 block">
                    Mode
                </label>
                <div className="flex bg-[#3B82F6] rounded-lg p-1">
                    <button
                        onClick={() => setActiveMode("interactive")}
                        className={`w-1/2 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                            activeMode === "interactive"
                                ? "bg-[#10B981] text-white shadow-sm"
                                : "text-white/80 hover:text-white"
                        }`}
                    >
                        Interactive
                    </button>
                    <button
                        onClick={() => setActiveMode("manual")}
                        className={`w-1/2 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                            activeMode === "manual"
                                ? "bg-[#10B981] text-white shadow-sm"
                                : "text-white/80 hover:text-white"
                        }`}
                    >
                        Manual
                    </button>
                </div>
            </div>

            {/* Navigation Links (Accordion) */}
            <nav className="flex-grow space-y-1">
                <AccordionItem
                    title="Power"
                    isOpen={openAccordion === "power"}
                    onClick={() => toggleAccordion("power")}
                />
                <AccordionItem
                    title="Terminal"
                    isOpen={openAccordion === "terminal"}
                    onClick={() => toggleAccordion("terminal")}
                />
                <AccordionItem
                    title="Processes"
                    isOpen={openAccordion === "processes"}
                    onClick={() => toggleAccordion("processes")}
                />
            </nav>

            {/* Sidebar Footer */}
            <div className="mt-auto">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Device</span>
                    {/* Battery icon omitted as requested */}
                </div>
            </div>
        </div>
    );
};


// --- Main Content Area ---

/**
 * Main Content Area
 */
export const MainContent: React.FC<MainContentProps> = ({
                                                            disabled,
                                                            addAction,
                                                            frames = [],
                                                            tiles = [],
                                                        }) => {
    // get latest full-frame (jpg) if any
    const latestFrame = frames && frames.length ? frames[frames.length - 1] : null;

    return (
        <div className="flex-1 bg-[#F3F4F6] p-8 flex flex-col items-center">
            {/* Canvas Area */}
            <div className="canvas-container w-full" style={{ maxWidth: 1280 }}>
                <div
                    className="canvas-placeholder"
                    style={{
                        position: 'relative',
                        width: '100%',
                        // enforce 16:9 aspect ratio visually
                        aspectRatio: '16/9',
                        background: '#111827', // Use text color as dark background
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '0.75rem', // rounded-xl
                        boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)', // shadow-inner
                    }}
                >
                    {/* render latest full-frame JPEG as background/full image */}
                    {latestFrame && (
                        <img
                            src={`data:image/jpeg;base64,${latestFrame.image}`}
                            alt="screen-frame"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                zIndex: 1,
                                pointerEvents: 'none',
                            }}
                        />
                    )}

                    {/* render tiles (png) on top */}
                    {tiles &&
                        tiles.map((t: Tile) => {
                            const imgSrc = t.image
                                ? `data:image/png;base64,${t.image}`
                                : undefined;
                            const style: React.CSSProperties = {
                                position: 'absolute',
                                left: typeof t.x === 'number' ? t.x : 0,
                                top: typeof t.y === 'number' ? t.y : 0,
                                width: typeof t.width === 'number' ? t.width : undefined,
                                height: typeof t.height === 'number' ? t.height : undefined,
                                zIndex: 2,
                                pointerEvents: 'none',
                                imageRendering: 'pixelated',
                            };
                            return imgSrc ? (
                                <img
                                    key={t.id ?? crypto.randomUUID()}
                                    src={imgSrc}
                                    alt="tile"
                                    style={style}
                                />
                            ) : null;
                        })}

                    {!latestFrame && (
                        <div
                            className="canvas-content"
                            style={{
                                position: 'relative',
                                zIndex: 3,
                                color: '#D1D5DB', // Light gray text
                            }}
                        >
              <span className="canvas-text text-lg font-medium">
                Interactive Canvas Area
              </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions (Only Stream Buttons) */}
            <div className="quick-actions mt-6">
                <div className="action-buttons flex gap-4">
                    <button
                        className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium shadow hover:bg-[#1E3A8A] disabled:bg-[#D1D5DB] disabled:text-[#8F8F8F] disabled:cursor-not-allowed transition-colors"
                        onClick={() =>
                            addAction({
                                id: crypto.randomUUID(),
                                type: 'screen.start',
                                payload: {},
                            })
                        }
                        disabled={disabled}
                    >
                        Start Screen Stream
                    </button>
                    <button
                        className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium shadow hover:bg-[#1E3A8A] disabled:bg-[#D1D5DB] disabled:text-[#8F8F8F] disabled:cursor-not-allowed transition-colors"
                        onClick={() =>
                            addAction({
                                id: crypto.randomUUID(),
                                type: 'screen.stop',
                                payload: {},
                            })
                        }
                        disabled={disabled}
                    >
                        Stop Screen Stream
                    </button>
                </div>
            </div>
        </div>
    );
};

