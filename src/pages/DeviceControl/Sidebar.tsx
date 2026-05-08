import type { SidebarProps, AccordionSection, CommandAction } from './types';
import type { WebRtcConnectionState } from './hooks/useWebRtc';
import { ChevronLeftIcon } from './icons';
import { AccordionItem } from './AccordionItem';
import { FpsControls } from './components/FpsControls';
import { ResolutionControl } from './components/ResolutionControl';
import { FilesToggleIcon } from './components/FileManager/icons';
import { HeaderTransferPill } from './components/HeaderTransferPill';
import { ClipboardPill } from './components/ClipboardPill';
import type { ClipboardPillProps } from './components/ClipboardPill';
import type { QueueState } from './services/transfer';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { generateUUID } from 'src/utils/uuid';

type PowerCommand =
  | 'power.shutdown'
  | 'power.restart'
  | 'power.sleep'
  | 'power.hibernate'
  | 'power.logOff'
  | 'power.lock';

interface ExtendedSidebarProps extends SidebarProps {
  addAction?: (action: CommandAction) => void;
  onStartStream?: () => void;
  onStopStream?: () => void;
  connectionState?: WebRtcConnectionState;
  showStats?: boolean;
  onToggleStats?: () => void;
  currentFps?: number;
  onFpsChange?: (fps: number) => void;
  currentResolution?: number;
  onResolutionChange?: (resolution: number) => void;
  deviceName?: string;
  transferSnapshot?: QueueState;
  onOpenPanel?: () => void;
  /**
   * Phase 16: clipboard sync pill prop bundle. The pill renders ABOVE the
   * HeaderTransferPill whenever WebRTC peer connection is up, regardless of
   * panelOpen (D-05). Internally gated on `clipboardPill.webRtcUp`.
   */
  clipboardPill?: ClipboardPillProps;
}

export function Sidebar({
  activeMode,
  setActiveMode,
  openAccordion,
  setOpenAccordion,
  addAction,
  permissions,
  disabled,
  onStartStream,
  onStopStream,
  connectionState,
  showStats,
  onToggleStats,
  currentFps,
  onFpsChange,
  currentResolution,
  onResolutionChange,
  deviceName,
  onTogglePanel,
  panelOpen,
  transferSnapshot,
  onOpenPanel,
  clipboardPill,
}: ExtendedSidebarProps) {
  const { t } = useTranslation('deviceControl');
  const navigate = useNavigate();

  const toggleAccordion = (item: AccordionSection) => {
    setOpenAccordion(openAccordion === item ? null : item);
  };

  const POWER_OPTIONS: { key: PowerCommand; label: string }[] = [
    { key: 'power.shutdown', label: t('manual.power.shutdown') },
    { key: 'power.restart', label: t('manual.power.restart') },
    { key: 'power.sleep', label: t('manual.power.sleep') },
    { key: 'power.hibernate', label: t('manual.power.hibernate') },
    { key: 'power.logOff', label: t('manual.power.logOff') },
    { key: 'power.lock', label: t('manual.power.lock') },
  ];

  const sendAction = (type: string) => {
    if (!addAction) {
      console.warn('No addAction provided to Sidebar, cannot send command');
      return;
    }
    addAction({
      id: generateUUID(),
      type,
      payload: {},
    });
  };

  const isStreamActive = connectionState === 'connected' || connectionState === 'connecting' || connectionState === 'reconnecting';
  const isStreamBusy = connectionState === 'connecting' || connectionState === 'reconnecting';

  return (
    <div className="w-64 bg-primary text-white p-6 flex flex-col h-screen fixed left-0 top-0">
      {/* Sidebar Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate('/devices')}
          className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-200 cursor-pointer"
        >
          <ChevronLeftIcon className="w-8 h-8" />
        </button>
        <h2 className="text-xl font-semibold text-gray-200">{t('sidebar.control')}</h2>
      </div>

      {/* Mode Toggle */}
      <div className="mb-8">
        <label className="text-xs text-darkgray uppercase font-bold mb-2 block">
          {t('sidebar.mode')}
        </label>
        <div className="flex bg-secondary rounded-lg p-1">
          <button
            onClick={() => setActiveMode('interactive')}
            className={`w-1/2 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeMode === 'interactive'
                ? 'bg-accent text-white shadow-sm'
                : 'text-white/80 hover:text-white'
            }`}
          >
            {t('sidebar.interactive')}
          </button>
          <button
            onClick={() => setActiveMode('manual')}
            className={`w-1/2 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeMode === 'manual'
                ? 'bg-accent text-white shadow-sm'
                : 'text-white/80 hover:text-white'
            }`}
          >
            {t('sidebar.manual')}
          </button>
        </div>
      </div>

      {/* Panels toggle (Phase 10: Files) */}
      {onTogglePanel && (
        <div className="mb-8">
          <label className="text-xs text-darkgray uppercase font-bold mb-2 block">
            {t('sidebar.panels', 'Panels')}
          </label>
          <button
            type="button"
            onClick={onTogglePanel}
            aria-pressed={!!panelOpen}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              panelOpen
                ? 'bg-accent text-white'
                : 'bg-secondary text-white/90 hover:text-white'
            }`}
            title="Ctrl+Shift+F"
          >
            <FilesToggleIcon className="w-4 h-4" />
            <span>Files</span>
            <span className="ml-auto text-xs opacity-75">Ctrl+Shift+F</span>
          </button>
          {/* Phase 16: clipboard pill — always visible above transfer pill while WebRTC is up. PILL-01 / D-05. */}
          {clipboardPill && <ClipboardPill {...clipboardPill} />}
          {!panelOpen && transferSnapshot && (
            <HeaderTransferPill
              snapshot={transferSnapshot}
              onClick={() => (onOpenPanel ? onOpenPanel() : onTogglePanel())}
            />
          )}
        </div>
      )}

      {/* Quick screen actions - only show in interactive mode */}
      {activeMode === 'interactive' && permissions?.see_screen && (
        <div className="mb-6">
          <div className="flex gap-3">
            {!isStreamActive ? (
              <button
                className="flex-1 px-3 py-2 bg-secondary text-white rounded-lg text-sm font-medium shadow hover:bg-primary disabled:bg-lightgray disabled:text-darkgray disabled:cursor-not-allowed transition-colors"
                disabled={disabled}
                onClick={() => onStartStream ? onStartStream() : sendAction('screen.start')}
              >
                {t('manual.quick.startStream')}
              </button>
            ) : (
              <button
                className="flex-1 px-3 py-2 bg-secondary text-white rounded-lg text-sm font-medium shadow hover:bg-primary disabled:bg-lightgray disabled:text-darkgray disabled:cursor-not-allowed transition-colors"
                disabled={disabled || isStreamBusy}
                onClick={() => onStopStream ? onStopStream() : sendAction('screen.stop')}
              >
                {isStreamBusy ? 'Connecting...' : t('manual.quick.stopStream')}
              </button>
            )}
          </div>
          {/* Stream controls - only when stream is active */}
          {isStreamActive && !isStreamBusy && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                {onResolutionChange && currentResolution != null && (
                  <ResolutionControl
                    currentResolution={currentResolution}
                    onResolutionChange={onResolutionChange}
                    disabled={disabled}
                  />
                )}
                {onToggleStats && (
                  <button
                    onClick={onToggleStats}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      showStats
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {showStats ? t('sidebar.hideStats') : t('sidebar.showStats')}
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                {onFpsChange && currentFps != null && (
                  <FpsControls currentFps={currentFps} onFpsChange={onFpsChange} disabled={disabled} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Links (Accordion) - HIDDEN in Manual mode */}
      {activeMode !== 'manual' && (
        <nav className="flex-grow space-y-1">
          <AccordionItem
            title={t('sidebar.power')}
            isOpen={openAccordion === 'power'}
            onClick={() => toggleAccordion('power')}
          />
          {openAccordion === 'power' && (
            <div className="mt-2 ml-2 mr-2 p-2 rounded">
              {POWER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => sendAction(opt.key)}
                  className="w-full text-left px-3 py-2 mb-2 cursor-pointer rounded text-sm hover:bg-white/10 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </nav>
      )}

      {/* Sidebar Footer */}
      <div className="mt-auto">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300 truncate" title={deviceName}>
            {deviceName || t('sidebar.device')}
          </span>
        </div>
      </div>
    </div>
  );
}
