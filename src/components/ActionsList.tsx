import React from "react";

interface Props {
    actions: any[];
    removeAction: (idx: number) => void;
    clearActions: () => void;
    sendActions: () => void;
    disabled: boolean;
}

export default function ActionsList({ actions, removeAction, clearActions, sendActions, disabled }: Props) {
    return (
        <div>
            <h3>Pending Actions ({actions.length})</h3>
            <div>
                <button className="button-primary" onClick={sendActions} disabled={disabled || actions.length === 0}>Send Actions</button>
                &nbsp;
                <button className="button-secondary" onClick={clearActions} disabled={actions.length === 0}>Clear</button>
            </div>

            <ol>
                {actions.map((a, i) => (
                    <li key={a.id ?? i} style={{ marginBottom: 8 }}>
                        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(a, null, 2)}</pre>
                        <button className="button-secondary" onClick={() => removeAction(i)} disabled={disabled}>Remove</button>
                    </li>
                ))}
            </ol>
        </div>
    );
}

