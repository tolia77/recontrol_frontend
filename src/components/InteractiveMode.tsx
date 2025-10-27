import React, { useState } from "react";
import { uuidv4 } from "src/utils/uuid";

export default function InteractiveMode({ disabled, addAction }: {
    disabled: boolean;
    addAction: (a: any) => void;
}) {
    const [activeTool, setActiveTool] = useState<string>("select");

    const tools = [
        { id: "select", label: "Select", icon: "🔍" },
        { id: "click", label: "Click", icon: "👆" },
        { id: "type", label: "Type", icon: "⌨️" },
        { id: "drag", label: "Drag", icon: "↔️" },
        { id: "right-click", label: "Right Click", icon: "🖱️" }
    ];

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
            <div className="canvas-container">
                <div className="canvas-placeholder">
                    <div className="canvas-content">
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
                </div>
            </div>
        </div>
    );
}

