import React from "react";

interface Message {
    from: string;
    command: string;
    payload: Record<string, any>;
}

interface Props {
    messages: Message[];
}

export default function MessagesList({ messages }: Props) {
    return (
        <div>
            <h3>Messages:</h3>
            <ul>
                {messages.map((m, i) => (
                    <li key={i}>
                        <strong>{m.from}</strong>: {m.command} - <pre style={{ display: "inline" }}>{JSON.stringify(m.payload)}</pre>
                    </li>
                ))}
            </ul>
        </div>
    );
}

