import React, { useCallback, useState } from 'react';
import { mapButtonToBackend } from './utils/mouse.ts';
import { useTranslation } from 'react-i18next';
import { Button, Input } from 'src/components/ui';

export const ManualMouseControls: React.FC<{
    disabled: boolean;
    addAction?: (action: any) => void;
}> = ({ disabled, addAction }) => {
    const { t } = useTranslation('deviceControl');
    const [xVal, setXVal] = useState<number>(0);
    const [yVal, setYVal] = useState<number>(0);
    const [scrollClicks, setScrollClicks] = useState<number>(1);

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

    const clickSeq = useCallback(async (logicalBtn: number, times = 1) => {
        for (let i = 0; i < times; i++) {
            sendDown(logicalBtn);
            await sleep(CLICK_DELAY_MS);
            sendUp(logicalBtn);
            if (i < times - 1) {
                await sleep(CLICK_DELAY_MS);
            }
        }
    }, [sendDown, sendUp]);

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-text mb-4">{t('manual.mouse.title')}</h3>

            {/* Position Section */}
            <div className="border border-lightgray rounded-lg p-4 bg-tertiary">
                <h4 className="text-sm font-medium text-text mb-3">{t('manual.mouse.position')}</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <label className="flex flex-col text-sm">
                        <span className="text-darkgray mb-1">X</span>
                        <Input
                            type="number"
                            className="text-xs px-2 py-1"
                            value={xVal}
                            onChange={(e) => setXVal(Number(e.target.value))}
                            disabled={disabled}
                        />
                    </label>
                    <label className="flex flex-col text-sm">
                        <span className="text-darkgray mb-1">Y</span>
                        <Input
                            type="number"
                            className="text-xs px-2 py-1"
                            value={yVal}
                            onChange={(e) => setYVal(Number(e.target.value))}
                            disabled={disabled}
                        />
                    </label>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={disabled}
                    onClick={() => send('mouse.move', { X: Math.round(xVal), Y: Math.round(yVal) })}
                >
                    {t('manual.mouse.moveBtn')}
                </Button>
            </div>

            {/* Click Actions Section */}
            <div className="border border-lightgray rounded-lg p-4 bg-tertiary">
                <h4 className="text-sm font-medium text-text mb-3">{t('manual.mouse.buttons')}</h4>
                <div className="space-y-3">
                    {/* Left Button */}
                    <div>
                        <p className="text-xs text-darkgray mb-2">{t('manual.mouse.left')}</p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => sendDown(0)}>{t('manual.mouse.down')}</Button>
                            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => sendUp(0)}>{t('manual.mouse.up')}</Button>
                            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => { void clickSeq(0, 1); }}>{t('manual.mouse.click')}</Button>
                            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => { void clickSeq(0, 2); }}>{t('manual.mouse.double')}</Button>
                        </div>
                    </div>

                    {/* Right Button */}
                    <div>
                        <p className="text-xs text-darkgray mb-2">{t('manual.mouse.right')}</p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => sendDown(2)}>{t('manual.mouse.down')}</Button>
                            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => sendUp(2)}>{t('manual.mouse.up')}</Button>
                            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => { void clickSeq(2, 1); }}>{t('manual.mouse.click')}</Button>
                        </div>
                    </div>

                    {/* Middle Button */}
                    <div>
                        <p className="text-xs text-darkgray mb-2">{t('manual.mouse.middle')}</p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => sendDown(1)}>{t('manual.mouse.down')}</Button>
                            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => sendUp(1)}>{t('manual.mouse.up')}</Button>
                            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => { void clickSeq(1, 1); }}>{t('manual.mouse.click')}</Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scroll Section */}
            <div className="border border-lightgray rounded-lg p-4 bg-tertiary">
                <h4 className="text-sm font-medium text-text mb-3">{t('manual.mouse.scroll')}</h4>
                <div className="flex items-end gap-3">
                    <label className="flex flex-col text-sm flex-1">
                        <span className="text-darkgray mb-1">{t('manual.mouse.scrollClicks')}</span>
                        <Input
                            type="number"
                            className="text-xs px-2 py-1"
                            value={scrollClicks}
                            onChange={(e) => setScrollClicks(Math.max(1, Number(e.target.value) || 1))}
                            disabled={disabled}
                            min={1}
                        />
                    </label>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" disabled={disabled} onClick={() => send('mouse.scroll', { Clicks: +Math.abs(scrollClicks) })}>
                            {t('manual.mouse.scrollUp')}
                        </Button>
                        <Button variant="secondary" size="sm" disabled={disabled} onClick={() => send('mouse.scroll', { Clicks: -Math.abs(scrollClicks) })}>
                            {t('manual.mouse.scrollDown')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
