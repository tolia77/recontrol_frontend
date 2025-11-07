// filepath: src/pages/DeviceSettings/components/SaveGroupPanel.tsx
import React from 'react';

export interface SaveGroupPanelProps {
  t: any;
  name: string;
  onChange: (name: string) => void;
  onSave: () => void;
}

export const SaveGroupPanel: React.FC<SaveGroupPanelProps> = ({ t, name, onChange, onSave }) => {
  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {t('form.newGroupName')}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={onSave}
          className="px-3 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 whitespace-nowrap"
        >
          {t('form.saveGroup')}
        </button>
      </div>
    </div>
  );
};

