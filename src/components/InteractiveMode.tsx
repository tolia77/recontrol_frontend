import React, { useState } from "react";
import { uuidv4 } from "src/utils/uuid";

export default function InteractiveMode({ disabled, addAction, frames = [], tiles = [] }: {
    disabled: boolean;
    addAction: (a: any) => void;
    frames?: { id: string; image: string }[];
    tiles?: any[];
}) {
    const [activeTool, setActiveTool] = useState<string>("select");

    const tools = [
        { id: "select", label: "Select", icon: "🔍" },
        { id: "click", label: "Click", icon: "👆" },
        { id: "type", label: "Type", icon: "⌨️" },
        { id: "drag", label: "Drag", icon: "↔️" },
        { id: "right-click", label: "Right Click", icon: "🖱️" }
    ];

    // get latest full-frame (jpg) if any
    const latestFrame = frames && frames.length ? frames[frames.length - 1] : null;

    return (
        <div className="interactive-mode">
            {/* Menu Bar */}
            <div className="menu-bar">
                <div className="menu-section">
                    <span className="menu-title">File</span>
                    <span className="menu-title">Edit</span>
                    <span className="menu-title">View</span>
                    <span className="menu-title">Tools</span>
                </div>
                <div className="menu-section">
                    <span className="status-indicator">
                        Status: {disabled ? "Disconnected" : "Connected"}
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="toolbar">
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                        onClick={() => setActiveTool(tool.id)}
                        disabled={disabled}
                    >
                        <span className="tool-icon">{tool.icon}</span>
                        {tool.label}
                    </button>
                ))}
            </div>

            {/* Canvas Area */}
            <div className="canvas-container" style={{ maxWidth: 1280 }}>
                <div
                    className="canvas-placeholder"
                    style={{
                        position: "relative",
                        width: "100%",
                        // enforce 16:9 aspect ratio visually
                        aspectRatio: "16/9",
                        background: "#111",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    {/* render latest full-frame JPEG as background/full image */}
                    {latestFrame && (
                        <img
                            src={`data:image/jpeg;base64,${latestFrame.image}`}
                            alt="screen-frame"
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                zIndex: 1,
                                pointerEvents: "none"
                            }}
                        />
                    )}

                    {/* render tiles (png) on top */}
                    {tiles && tiles.map((t: any) => {
                        const imgSrc = t.image ? `data:image/png;base64,${t.image}` : undefined;
                        const style: React.CSSProperties = {
                            position: "absolute",
                            left: typeof t.x === "number" ? t.x : 0,
                            top: typeof t.y === "number" ? t.y : 0,
                            width: typeof t.width === "number" ? t.width : undefined,
                            height: typeof t.height === "number" ? t.height : undefined,
                            zIndex: 2,
                            pointerEvents: "none",
                            imageRendering: "pixelated"
                        };
                        return imgSrc ? <img key={t.id ?? uuidv4()} src={imgSrc} alt="tile" style={style} /> : null;
                    })}

                    <div className="canvas-content" style={{ position: "relative", zIndex: 3, color: "#fff" }}>
                        <span className="canvas-text">Interactive Canvas Area (16:9)</span>
                        <span className="canvas-subtext">
                            Selected: {tools.find(t => t.id === activeTool)?.label}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
                <h4>Quick Actions</h4>
                <div className="action-buttons">
                    <button className="btn-secondary" onClick={() => addAction({
                        id: uuidv4(),
                        type: "mouse.click",
                        payload: { button: "Left" }
                    })} disabled={disabled}>
                        Left Click
                    </button>
                    <button className="btn-secondary" onClick={() => addAction({
                        id: uuidv4(),
                        type: "mouse.rightClick",
                        payload: {}
                    })} disabled={disabled}>
                        Right Click
                    </button>
                    <button className="btn-secondary" onClick={() => addAction({
                        id: uuidv4(),
                        type: "keyboard.press",
                        payload: { key: "Enter" }
                    })} disabled={disabled}>
                        Press Enter
                    </button>

                    {/* Screen stream controls */}
                    <button className="btn-secondary" onClick={() => addAction({
                        id: uuidv4(),
                        type: "screen.start",
                        payload: {}
                    })} disabled={disabled}>
                        Start Screen Stream
                    </button>
                    <button className="btn-secondary" onClick={() => addAction({
                        id: uuidv4(),
                        type: "screen.stop",
                        payload: {}
                    })} disabled={disabled}>
                        Stop Screen Stream
                    </button>
                </div>
            </div>
        </div>
    );
}
