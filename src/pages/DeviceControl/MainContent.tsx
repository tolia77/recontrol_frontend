import React from 'react';
import type {MainContentProps} from './types.ts';

/**
 * Main Content Area
 */
export const MainContent: React.FC<MainContentProps> = ({
                                                            disabled,
                                                            addAction,
                                                            frames = [],
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
