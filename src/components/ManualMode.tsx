import React, { useState } from "react";
import { uuidv4 } from "src/utils/uuid";

export default function ManualMode({ disabled, addAction }: {
    disabled: boolean;
    addAction: (a: any) => void;
}) {
    const [activeSection, setActiveSection] = useState<"keyboard" | "mouse" | "terminal">("keyboard");

    // Keyboard state
    const [kbdKey, setKbdKey] = useState("A");
    const [kbdHoldMs, setKbdHoldMs] = useState<number | "">("");

    // Mouse state
    const [mouseDeltaX, setMouseDeltaX] = useState<number>(0);
    const [mouseDeltaY, setMouseDeltaY] = useState<number>(0);
    const [mouseButton, setMouseButton] = useState<"Left" | "Right" | "Middle">("Left");
    const [mouseDelayMs, setMouseDelayMs] = useState<number | "">("");

    // Terminal state
    const [termCommand, setTermCommand] = useState("");
    const [termTimeout, setTermTimeout] = useState<number | "">("");
    const [termPid, setTermPid] = useState<number | "">("");
    const [termFileName, setTermFileName] = useState("");
    const [termArgs, setTermArgs] = useState("");
    const [termRedirectOutput, setTermRedirectOutput] = useState(false);
    const [termPath, setTermPath] = useState("");
    const [termForceKill, setTermForceKill] = useState(false);

    return (
        <div className="manual-mode">
            <div className="mode-header">
                <h3>Manual Action Builder</h3>
                <div className="section-tabs">
                    <button
                        className={`tab-btn ${activeSection === "keyboard" ? "active" : ""}`}
                        onClick={() => setActiveSection("keyboard")}
                    >
                        Keyboard
                    </button>
                    <button
                        className={`tab-btn ${activeSection === "mouse" ? "active" : ""}`}
                        onClick={() => setActiveSection("mouse")}
                    >
                        Mouse
                    </button>
                    <button
                        className={`tab-btn ${activeSection === "terminal" ? "active" : ""}`}
                        onClick={() => setActiveSection("terminal")}
                    >
                        Terminal
                    </button>
                </div>
            </div>

            <div className="section-content">
                {activeSection === "keyboard" && (
                    <div className="keyboard-section">
                        <div className="input-group">
                            <label className="input-label">
                                Key:
                                <input
                                    className="small-input"
                                    value={kbdKey}
                                    onChange={(e) => setKbdKey(e.target.value)}
                                    disabled={disabled}
                                />
                            </label>
                            <label className="input-label">
                                Hold (ms):
                                <input
                                    className="small-input"
                                    type="number"
                                    value={kbdHoldMs}
                                    onChange={(e) => setKbdHoldMs(e.target.value === "" ? "" : Number(e.target.value))}
                                    disabled={disabled}
                                />
                            </label>
                        </div>
                        <div className="action-buttons">
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "keyboard.keyDown",
                                payload: { key: kbdKey }
                            })} disabled={disabled}>
                                Key Down
                            </button>
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "keyboard.keyUp",
                                payload: { key: kbdKey }
                            })} disabled={disabled}>
                                Key Up
                            </button>
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "keyboard.press",
                                payload: {
                                    key: kbdKey,
                                    ...(kbdHoldMs !== "" ? { holdMs: Number(kbdHoldMs) } : {})
                                }
                            })} disabled={disabled}>
                                Press Key
                            </button>
                        </div>
                    </div>
                )}

                {activeSection === "mouse" && (
                    <div className="mouse-section">
                        <div className="input-group">
                            <label className="input-label">
                                Delta X:
                                <input
                                    className="small-input"
                                    type="number"
                                    value={mouseDeltaX}
                                    onChange={(e) => setMouseDeltaX(Number(e.target.value))}
                                    disabled={disabled}
                                />
                            </label>
                            <label className="input-label">
                                Delta Y:
                                <input
                                    className="small-input"
                                    type="number"
                                    value={mouseDeltaY}
                                    onChange={(e) => setMouseDeltaY(Number(e.target.value))}
                                    disabled={disabled}
                                />
                            </label>
                            <label className="input-label">
                                Button:
                                <select
                                    className="small-input"
                                    value={mouseButton}
                                    onChange={(e) => setMouseButton(e.target.value as any)}
                                    disabled={disabled}
                                >
                                    <option>Left</option>
                                    <option>Right</option>
                                    <option>Middle</option>
                                </select>
                            </label>
                            <label className="input-label">
                                Delay (ms):
                                <input
                                    className="small-input"
                                    type="number"
                                    value={mouseDelayMs}
                                    onChange={(e) => setMouseDelayMs(e.target.value === "" ? "" : Number(e.target.value))}
                                    disabled={disabled}
                                />
                            </label>
                        </div>
                        <div className="action-buttons">
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "mouse.move",
                                payload: { deltaX: mouseDeltaX, deltaY: mouseDeltaY }
                            })} disabled={disabled}>
                                Move
                            </button>
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "mouse.click",
                                payload: {
                                    button: mouseButton,
                                    ...(mouseDelayMs !== "" ? { delayMs: Number(mouseDelayMs) } : {})
                                }
                            })} disabled={disabled}>
                                Click
                            </button>
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "mouse.doubleClick",
                                payload: {
                                    ...(mouseDelayMs !== "" ? { delayMs: Number(mouseDelayMs) } : {})
                                }
                            })} disabled={disabled}>
                                Double Click
                            </button>
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "mouse.scroll",
                                payload: { clicks: mouseDeltaY }
                            })} disabled={disabled}>
                                Scroll
                            </button>
                        </div>
                    </div>
                )}

                {activeSection === "terminal" && (
                    <div className="terminal-section">
                        <div className="terminal-subsection">
                            <h4>Command Execution</h4>
                            <div className="input-group">
                                <label className="input-label">
                                    Command:
                                    <input
                                        className="small-input"
                                        value={termCommand}
                                        onChange={(e) => setTermCommand(e.target.value)}
                                        disabled={disabled}
                                    />
                                </label>
                                <label className="input-label">
                                    Timeout (ms):
                                    <input
                                        className="small-input"
                                        type="number"
                                        value={termTimeout}
                                        onChange={(e) => setTermTimeout(e.target.value === "" ? "" : Number(e.target.value))}
                                        disabled={disabled}
                                    />
                                </label>
                            </div>
                            <div className="action-buttons">
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.execute",
                                    payload: {
                                        command: termCommand,
                                        ...(termTimeout !== "" ? { timeout: Number(termTimeout) } : {})
                                    }
                                })} disabled={disabled}>
                                    Execute
                                </button>
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.powershell",
                                    payload: {
                                        command: termCommand,
                                        ...(termTimeout !== "" ? { timeout: Number(termTimeout) } : {})
                                    }
                                })} disabled={disabled}>
                                    PowerShell
                                </button>
                            </div>
                        </div>

                        <div className="terminal-subsection">
                            <h4>Process Management</h4>
                            <div className="input-group">
                                <label className="input-label">
                                    PID:
                                    <input
                                        className="small-input"
                                        type="number"
                                        value={termPid}
                                        onChange={(e) => setTermPid(e.target.value === "" ? "" : Number(e.target.value))}
                                        disabled={disabled}
                                    />
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={termForceKill}
                                        onChange={(e) => setTermForceKill(e.target.checked)}
                                        disabled={disabled}
                                    />
                                    Force Kill
                                </label>
                            </div>
                            <div className="action-buttons">
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.killProcess",
                                    payload: { pid: Number(termPid), force: termForceKill }
                                })} disabled={disabled}>
                                    Kill Process
                                </button>
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.listProcesses",
                                    payload: {}
                                })} disabled={disabled}>
                                    List Processes
                                </button>
                            </div>
                        </div>

                        <div className="terminal-subsection">
                            <h4>System Commands</h4>
                            <div className="input-group">
                                <label className="input-label">
                                    Working Directory:
                                    <input
                                        className="small-input"
                                        value={termPath}
                                        onChange={(e) => setTermPath(e.target.value)}
                                        disabled={disabled}
                                    />
                                </label>
                            </div>
                            <div className="action-buttons">
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.getCwd",
                                    payload: {}
                                })} disabled={disabled}>
                                    Get CWD
                                </button>
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.setCwd",
                                    payload: { path: termPath }
                                })} disabled={disabled}>
                                    Set CWD
                                </button>
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.whoAmI",
                                    payload: {}
                                })} disabled={disabled}>
                                    WhoAmI
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

