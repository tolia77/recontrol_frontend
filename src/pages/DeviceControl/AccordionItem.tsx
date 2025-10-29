import React from 'react';
import type {AccordionItemProps} from './types.ts';
import { ChevronDownIcon } from './icons.tsx';

/**
 * AccordionItem Component
 * @param {string} title - The text to display for the item
 * @param {boolean} isOpen - Whether the accordion item is currently open
 * @param {function} onClick - Function to call when the item is clicked
 */
export const AccordionItem: React.FC<AccordionItemProps> = ({ title, isOpen, onClick }) => {
    return (
        <div>
            <button
                onClick={onClick}
                className="flex justify-between items-center w-full text-left py-3 px-3 rounded-lg text-gray-200 hover:bg-white/10 focus:outline-none focus:bg-white/10 transition-colors duration-200"
            >
                <span className="font-medium">{title}</span>
                <ChevronDownIcon
                    className={`w-5 h-5 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>
            {/* You can add content here to show when isOpen is true */}
            {/*
      {isOpen && (
        <div className="pl-6 pt-2 pb-1 text-gray-300">
          <p>Sub-item 1</p>
          <p>Sub-item 2</p>
        </div>
      )}
      */}
        </div>
    );
};

