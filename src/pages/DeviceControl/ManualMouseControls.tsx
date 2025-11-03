import React, { useCallback, useState } from 'react';
import { mapButtonToBackend } from './utils/mouse.ts';

export const ManualMouseControls: React.FC<{
    disabled: boolean;
    addAction?: (action: any) => void;
}> = ({ disabled, addAction }) => {
    const [xVal, setXVal] = useState<number>(0);
    const [yVal, setYVal] = useState<number>(0);
    const [scrollClicks, setScrollClicks] = useState<number>(1);

    // small helper sleep (50ms)
    const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
    const CLICK_DELAY_MS = 50;

    const send = useCallback((type: string, payload: Record<string, any>) => {
        if (!addAction || disabled) return;
        addAction({ id: crypto.randomUUID(), type, payload });
    }, [addAction, disabled]);

    const sendDown = useCallback((logicalBtn: number) => {
        send('mouse.down', { Button: mapButtonToBackend(logicalBtn) });
    }, [send]);

    const sendUp = useCallback((logicalBtn: number) => {
        send('mouse.up', { Button: mapButtonToBackend(logicalBtn) });
    }, [send]);

    // add 50ms delays between events
    const clickSeq = useCallback(async (logicalBtn: number, times = 1) => {
        for (let i = 0; i < times; i++) {
            sendDown(logicalBtn);
            await sleep(CLICK_DELAY_MS);
            sendUp(logicalBtn);
            // wait before next click (or just to separate down->up)
            if (i < times - 1) {
                await sleep(CLICK_DELAY_MS);
            }
        }
    }, [sendDown, sendUp]);

    return (
        <div className="flex-1 bg-[#F3F4F6] p-8 flex flex-col items-center">
            <div className="w-full max-w-xl bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <h3 className="text-lg font-semibold mb-3">Manual Mouse Controls</h3>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <label className="flex flex-col text-sm">
                        X
                        <input
                            type="number"
                            className="small-input"
                            value={xVal}
                            onChange={(e) => setXVal(Number(e.target.value))}
                            disabled={disabled}
                        />
                    </label>
                    <label className="flex flex-col text-sm">
                        Y
                        <input
                            type="number"
                            className="small-input"
                            value={yVal}
                            onChange={(e) => setYVal(Number(e.target.value))}
                            disabled={disabled}
                        />
                    </label>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        className="btn-primary"
                        disabled={disabled}
                        onClick={() => send('mouse.move', { X: Math.round(xVal), Y: Math.round(yVal) })}
                    >
                        Move to (X,Y)
                    </button>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                    <div className="flex flex-wrap gap-2">
                        <button className="btn-secondary" disabled={disabled} onClick={() => sendDown(0)}>Left Down</button>
                        <button className="btn-secondary" disabled={disabled} onClick={() => sendUp(0)}>Left Up</button>
                        <button className="btn-secondary" disabled={disabled} onClick={() => { void clickSeq(0, 1); }}>Left Click</button>
                        <button className="btn-secondary" disabled={disabled} onClick={() => { void clickSeq(0, 2); }}>Left Double</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button className="btn-secondary" disabled={disabled} onClick={() => sendDown(2)}>Right Down</button>
                        <button className="btn-secondary" disabled={disabled} onClick={() => sendUp(2)}>Right Up</button>
                        <button className="btn-secondary" disabled={disabled} onClick={() => { void clickSeq(2, 1); }}>Right Click</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button className="btn-secondary" disabled={disabled} onClick={() => sendDown(1)}>Middle Down</button>
                        <button className="btn-secondary" disabled={disabled} onClick={() => sendUp(1)}>Middle Up</button>
                        <button className="btn-secondary" disabled={disabled} onClick={() => { void clickSeq(1, 1); }}>Middle Click</button>
                    </div>
                </div>

                <div className="flex items-end gap-3">
                    <label className="flex flex-col text-sm">
                        Scroll clicks
                        <input
                            type="number"
                            className="small-input"
                            value={scrollClicks}
                            onChange={(e) => setScrollClicks(Math.max(1, Number(e.target.value) || 1))}
                            disabled={disabled}
                            min={1}
                        />
                    </label>
                    <div className="flex gap-2">
                        <button className="btn-secondary" disabled={disabled} onClick={() => send('mouse.scroll', { Clicks: +Math.abs(scrollClicks) })}>Scroll Up</button>
                        <button className="btn-secondary" disabled={disabled} onClick={() => send('mouse.scroll', { Clicks: -Math.abs(scrollClicks) })}>Scroll Down</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
