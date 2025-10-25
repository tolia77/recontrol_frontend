import React from "react";

interface Props {
    deviceId: string;
    setDeviceId: (v: string) => void;
    connected: boolean;
    isConnecting: boolean;
    onConnect: () => void;
}

export default function DeviceConnect({ deviceId, setDeviceId, connected, isConnecting, onConnect }: Props) {
    const disabled = connected || isConnecting;

    return (
        <div>
            <label>
                Device ID:&nbsp;
                <input
                    className="small"
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="Enter device ID"
                    disabled={disabled}
                />
            </label>
            &nbsp;
            <button className="button-primary" onClick={onConnect} disabled={!deviceId || disabled}>
                Connect
            </button>
        </div>
    );
}

