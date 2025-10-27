import React from "react";

interface Props {
    deviceId: string;
    connected: boolean;
    isConnecting: boolean;
}

export default function DeviceConnect({ deviceId, connected, isConnecting }: Props) {
    const statusText = isConnecting ? "Connecting..." : connected ? "Connected" : "Disconnected";
    return (
        <div>
            <div>
                <strong>Device ID:</strong>&nbsp;
                <span>{deviceId || <em>No device_id in URL</em>}</span>
            </div>
            <div style={{ marginTop: 6 }}>
                <strong>Status:</strong>&nbsp;
                <span>{statusText}</span>
            </div>
        </div>
    );
}
