import type { SidebarProps, AccordionSection, CommandAction } from './types';
import { ChevronLeftIcon } from './icons';
import { AccordionItem } from './AccordionItem';
import { useTranslation } from 'react-i18next';
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
}

export function Sidebar({
  activeMode,
  setActiveMode,
  openAccordion,
  setOpenAccordion,
  addAction,
  permissions,
  disabled,
}: ExtendedSidebarProps) {
  const { t } = useTranslation('deviceControl');

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

  return (
    <div className="w-64 bg-primary text-white p-6 flex flex-col h-screen fixed left-0 top-0">
      {/* Sidebar Header */}
      <div className="flex items-center gap-3 mb-8">
        <button className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-200">
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

      {/* Quick screen actions - only show in interactive mode */}
      {activeMode === 'interactive' && permissions?.see_screen && (
        <div className="mb-6">
          <div className="flex gap-3">
            <button
              className="flex-1 px-3 py-2 bg-secondary text-white rounded-lg text-sm font-medium shadow hover:bg-primary disabled:bg-lightgray disabled:text-darkgray disabled:cursor-not-allowed transition-colors"
              disabled={disabled}
              onClick={() => sendAction('screen.start')}
            >
              {t('manual.quick.startStream')}
            </button>
            <button
              className="flex-1 px-3 py-2 bg-secondary text-white rounded-lg text-sm font-medium shadow hover:bg-primary disabled:bg-lightgray disabled:text-darkgray disabled:cursor-not-allowed transition-colors"
              disabled={disabled}
              onClick={() => sendAction('screen.stop')}
            >
              {t('manual.quick.stopStream')}
            </button>
          </div>
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
          <span className="text-sm text-gray-300">{t('sidebar.device')}</span>
        </div>
      </div>
    </div>
  );
}
