import React, { useState } from "react";
import { uuidv4 } from "src/utils/uuid";

interface Props {
    disabled: boolean;
    addAction: (a: any) => void;
}

export default function ActionBuilder({ disabled, addAction }: Props) {
    // Keyboard
    const [kbdKey, setKbdKey] = useState("A");
    const [kbdHoldMs, setKbdHoldMs] = useState<number | "">("");

    // Mouse
    const [mouseDeltaX, setMouseDeltaX] = useState<number>(0);
    const [mouseDeltaY, setMouseDeltaY] = useState<number>(0);
    const [mouseButton, setMouseButton] = useState<"Left" | "Right" | "Middle">("Left");
    const [mouseDelayMs, setMouseDelayMs] = useState<number | "">("");

    // Terminal
    const [termCommand, setTermCommand] = useState("");
    const [termTimeout, setTermTimeout] = useState<number | "">("");
    const [termPid, setTermPid] = useState<number | "">("");
    const [termFileName, setTermFileName] = useState("");
    const [termArgs, setTermArgs] = useState("");
    const [termRedirectOutput, setTermRedirectOutput] = useState(false);
    const [termPath, setTermPath] = useState("");
    const [termForceKill, setTermForceKill] = useState(false);

    const push = (obj: any) => addAction(obj);

    return (
        <div>
            <h3>Build Actions</h3>

            <section>
                <h4>Keyboard</h4>
                <label>Key:&nbsp; <input className="small" value={kbdKey} onChange={(e) => setKbdKey(e.target.value)} disabled={disabled} /></label>
                <label> Hold ms:&nbsp; <input className="small" type="number" value={kbdHoldMs as any} onChange={(e) => setKbdHoldMs(e.target.value === "" ? "" : Number(e.target.value))} disabled={disabled} /></label>
                <div>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "keyboard.keyDown", payload: { key: kbdKey } })} disabled={disabled}>Add KeyDown</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "keyboard.keyUp", payload: { key: kbdKey } })} disabled={disabled}>Add KeyUp</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "keyboard.press", payload: { key: kbdKey, ...(kbdHoldMs !== "" ? { holdMs: Number(kbdHoldMs) } : {}) } })} disabled={disabled}>Add Press</button>
                </div>
            </section>

            <section>
                <h4>Mouse</h4>
                <label>DeltaX:&nbsp; <input className="small" type="number" value={mouseDeltaX} onChange={(e) => setMouseDeltaX(Number(e.target.value))} disabled={disabled} /></label>
                <label>DeltaY:&nbsp; <input className="small" type="number" value={mouseDeltaY} onChange={(e) => setMouseDeltaY(Number(e.target.value))} disabled={disabled} /></label>
                <label>Button:&nbsp;
                    <select className="small" value={mouseButton} onChange={(e) => setMouseButton(e.target.value as any)} disabled={disabled}>
                        <option>Left</option>
                        <option>Right</option>
                        <option>Middle</option>
                    </select>
                </label>
                <label> Delay ms:&nbsp; <input className="small" type="number" value={mouseDelayMs as any} onChange={(e) => setMouseDelayMs(e.target.value === "" ? "" : Number(e.target.value))} disabled={disabled} /></label>
                <div>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "mouse.move", payload: { deltaX: Number(mouseDeltaX), deltaY: Number(mouseDeltaY) } })} disabled={disabled}>Add Move</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "mouse.down", payload: { button: mouseButton } })} disabled={disabled}>Add Down</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "mouse.up", payload: { button: mouseButton } })} disabled={disabled}>Add Up</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "mouse.scroll", payload: { clicks: Number(mouseDeltaY) } })} disabled={disabled}>Add Scroll</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "mouse.click", payload: { button: mouseButton, ...(mouseDelayMs !== "" ? { delayMs: Number(mouseDelayMs) } : {}) } })} disabled={disabled}>Add Click</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "mouse.doubleClick", payload: { ...(mouseDelayMs !== "" ? { delayMs: Number(mouseDelayMs) } : {}) } })} disabled={disabled}>Add DoubleClick</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "mouse.rightClick", payload: {} })} disabled={disabled}>Add RightClick</button>
                </div>
            </section>

            <section>
                <h4>Terminal</h4>
                <label>Command:&nbsp; <input className="small" value={termCommand} onChange={(e) => setTermCommand(e.target.value)} disabled={disabled} /></label>
                <label> Timeout ms:&nbsp; <input className="small" type="number" value={termTimeout as any} onChange={(e) => setTermTimeout(e.target.value === "" ? "" : Number(e.target.value))} disabled={disabled} /></label>
                <div>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "terminal.execute", payload: { command: termCommand, ...(termTimeout !== "" ? { timeout: Number(termTimeout) } : {}) } })} disabled={disabled}>Add Execute</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "terminal.powershell", payload: { command: termCommand, ...(termTimeout !== "" ? { timeout: Number(termTimeout) } : {}) } })} disabled={disabled}>Add Powershell</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "terminal.listProcesses", payload: {} })} disabled={disabled}>Add ListProcesses</button>
                </div>

                <div>
                    <label>PID:&nbsp; <input className="small" type="number" value={termPid as any} onChange={(e) => setTermPid(e.target.value === "" ? "" : Number(e.target.value))} disabled={disabled} /></label>
                    <label> Force:&nbsp; <input type="checkbox" checked={termForceKill} onChange={(e) => setTermForceKill(e.target.checked)} disabled={disabled} /></label>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "terminal.killProcess", payload: { pid: Number(termPid), force: !!termForceKill } })} disabled={disabled}>Add KillProcess</button>
                </div>

                <div>
                    <label>FileName:&nbsp; <input className="small" value={termFileName} onChange={(e) => setTermFileName(e.target.value)} disabled={disabled} /></label>
                    <label>Arguments:&nbsp; <input className="small" value={termArgs} onChange={(e) => setTermArgs(e.target.value)} disabled={disabled} /></label>
                    <label> RedirectOutput:&nbsp; <input type="checkbox" checked={termRedirectOutput} onChange={(e) => setTermRedirectOutput(e.target.checked)} disabled={disabled} /></label>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "terminal.startProcess", payload: { fileName: termFileName, arguments: termArgs, redirectOutput: termRedirectOutput } })} disabled={disabled}>Add StartProcess</button>
                </div>

                <div>
                    <label>Path (set cwd):&nbsp; <input className="small" value={termPath} onChange={(e) => setTermPath(e.target.value)} disabled={disabled} /></label>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "terminal.getCwd", payload: {} })} disabled={disabled}>Add GetCwd</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "terminal.setCwd", payload: { path: termPath } })} disabled={disabled}>Add SetCwd</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "terminal.whoAmI", payload: {} })} disabled={disabled}>Add WhoAmI</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "terminal.getUptime", payload: {} })} disabled={disabled}>Add GetUptime</button>
                    <button className="button-secondary" onClick={() => push({ id: uuidv4(), type: "terminal.abort", payload: {} })} disabled={disabled}>Add Abort</button>
                </div>
            </section>
        </div>
    );
}

