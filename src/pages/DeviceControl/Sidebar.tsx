import React from 'react';
import type {SidebarProps, AccordionSection} from './types.ts';
import { ChevronLeftIcon } from './icons.tsx';
import { AccordionItem } from './AccordionItem.tsx';

type PowerCommand =
  | 'power.shutdown'
  | 'power.restart'
  | 'power.sleep'
  | 'power.hibernate'
  | 'power.logOff'
  | 'power.lock';

const POWER_OPTIONS: { key: PowerCommand; label: string }[] = [
  { key: 'power.shutdown', label: 'Shutdown' },
  { key: 'power.restart', label: 'Restart' },
  { key: 'power.sleep', label: 'Sleep' },
  { key: 'power.hibernate', label: 'Hibernate' },
  { key: 'power.logOff', label: 'Log off' },
  { key: 'power.lock', label: 'Lock' },
];

/**
 * Sidebar Navigation
 */
export const Sidebar: React.FC<SidebarProps & { addAction?: (action: any) => void }> = ({
    activeMode,
    setActiveMode,
    openAccordion,
    setOpenAccordion,
    addAction,
}) => {
     const toggleAccordion = (item: AccordionSection) => {
         setOpenAccordion(openAccordion === item ? null : item);
     };

     return (
         <div className="w-64 bg-[#1E3A8A] text-white p-6 flex flex-col h-screen fixed left-0 top-0">
             {/* Sidebar Header */}
             <div className="flex items-center gap-3 mb-8">
                 <button className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-200">
                     <ChevronLeftIcon className="w-8 h-8" />
                 </button>
                 <h2 className="text-xl font-semibold text-gray-200">Control</h2>
             </div>

             {/* Mode Toggle */}
             <div className="mb-8">
                 <label className="text-xs text-[#8F8F8F] uppercase font-bold mb-2 block">
                     Mode
                 </label>
                 <div className="flex bg-[#3B82F6] rounded-lg p-1">
                     <button
                         onClick={() => setActiveMode("interactive")}
                         className={`w-1/2 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                             activeMode === "interactive"
                                 ? "bg-[#10B981] text-white shadow-sm"
                                 : "text-white/80 hover:text-white"
                         }`}
                     >
                         Interactive
                     </button>
                     <button
                         onClick={() => setActiveMode("manual")}
                         className={`w-1/2 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                             activeMode === "manual"
                                 ? "bg-[#10B981] text-white shadow-sm"
                                 : "text-white/80 hover:text-white"
                         }`}
                     >
                         Manual
                     </button>
                 </div>
             </div>

             {/* Navigation Links (Accordion) - HIDDEN in Manual mode */}
             {activeMode !== 'manual' && (
               <nav className="flex-grow space-y-1">
                  {/* Power accordion */}
                  <AccordionItem
                      title="Power"
                      isOpen={openAccordion === "power"}
                      onClick={() => toggleAccordion("power")}
                  />
                  {openAccordion === "power" && (
                      <div className="mt-2 ml-2 mr-2 p-2 rounded">
                          {POWER_OPTIONS.map((opt) => (
                              <button
                                  key={opt.key}
                                  onClick={() => {
                                      if (!addAction) {
                                          console.warn('No addAction provided to Sidebar, cannot send command');
                                          return;
                                      }
                                      addAction({
                                          id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random()}`,
                                          type: opt.key,
                                          payload: {},
                                      });
                                  }}
                                  className="w-full text-left px-3 py-2 mb-2 cursor-pointer rounded text-sm"
                              >
                                  {opt.label}
                              </button>
                          ))}
                      </div>
                  )}
                  <AccordionItem
                      title="Terminal"
                      isOpen={openAccordion === "terminal"}
                      onClick={() => toggleAccordion("terminal")}
                  />
                  <AccordionItem
                      title="Processes"
                      isOpen={openAccordion === "processes"}
                      onClick={() => toggleAccordion("processes")}
                  />
               </nav>
             )}

             {/* Sidebar Footer */}
             <div className="mt-auto">
                 <div className="flex items-center justify-between">
                     <span className="text-sm text-gray-300">Device</span>
                 </div>
             </div>
         </div>
     );
 };
