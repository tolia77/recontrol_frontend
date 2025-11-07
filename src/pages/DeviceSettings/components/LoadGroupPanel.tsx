// filepath: src/pages/DeviceSettings/components/LoadGroupPanel.tsx
import React from 'react';
import type { PermissionsGroup } from 'src/types/global';

export interface LoadGroupPanelProps {
  t: any;
  groups: PermissionsGroup[];
  value: string;
  onChange: (id: string) => void;
  onLoad: () => void;
}

export const LoadGroupPanel: React.FC<LoadGroupPanelProps> = ({ t, groups, value, onChange, onLoad }) => {
  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {t('form.permissionsGroup')}
      </label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">{t('form.selectPermissions')}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onLoad}
          className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 whitespace-nowrap"
        >
          {t('form.apply')}
        </button>
      </div>
    </div>
  );
};

