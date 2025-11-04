import React, { useCallback, useState } from 'react';

export const ManualKeyboardControls: React.FC<{
    disabled: boolean;
    addAction?: (action: any) => void;
}> = ({ disabled, addAction }) => {
    const [keyInput, setKeyInput] = useState<string>('');
    const [textInput, setTextInput] = useState<string>('');

    const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
    const CLICK_DELAY_MS = 50;

    const send = useCallback((type: string, payload: Record<string, any>) => {
        if (!addAction || disabled) return;
        addAction({ id: crypto.randomUUID(), type, payload });
    }, [addAction, disabled]);

    const sendKeyDown = useCallback((key: string) => {
        send('keyboard.keyDown', { Key: key });
    }, [send]);

    const sendKeyUp = useCallback((key: string) => {
        send('keyboard.keyUp', { Key: key });
    }, [send]);

    const keyPress = useCallback(async (key: string) => {
        if (!key) return;
        sendKeyDown(key);
        await sleep(CLICK_DELAY_MS);
        sendKeyUp(key);
    }, [sendKeyDown, sendKeyUp]);

    const typeText = useCallback(async (text: string) => {
        if (!text) return;
        for (const ch of text) {
            await keyPress(ch);
            await sleep(CLICK_DELAY_MS);
        }
    }, [keyPress]);

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Manual Keyboard Controls</h3>

            {/* Single Key Section */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Single Key</h4>
                <div className="space-y-3">
                    <label className="flex flex-col text-sm">
                        <span className="text-gray-600 mb-1">Key (virtual key name or single char)</span>
                        <input
                            type="text"
                            className="small-input"
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            disabled={disabled}
                            placeholder="e.g. A, Enter, VK_F1"
                        />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            className="btn-secondary"
                            disabled={disabled || !keyInput}
                            onClick={() => sendKeyDown(keyInput)}
                        >
                            Key Down
                        </button>
                        <button
                            className="btn-secondary"
                            disabled={disabled || !keyInput}
                            onClick={() => sendKeyUp(keyInput)}
                        >
                            Key Up
                        </button>
                        <button
                            className="btn-primary"
                            disabled={disabled || !keyInput}
                            onClick={() => { void keyPress(keyInput); }}
                        >
                            Key Press
                        </button>
                    </div>
                </div>
            </div>

            {/* Type Text Section */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Type Text</h4>
                <div className="space-y-3">
                    <label className="flex flex-col text-sm">
                        <span className="text-gray-600 mb-1">Text to type (each character sent as key press)</span>
                        <input
                            type="text"
                            className="small-input"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            disabled={disabled}
                            placeholder="Hello World"
                        />
                    </label>
                    <div className="flex gap-2">
                        <button
                            className="btn-primary"
                            disabled={disabled || !textInput}
                            onClick={() => { void typeText(textInput); }}
                        >
                            Type Text
                        </button>
                        <button
                            className="btn-secondary"
                            disabled={disabled || !textInput}
                            onClick={() => setTextInput('')}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

