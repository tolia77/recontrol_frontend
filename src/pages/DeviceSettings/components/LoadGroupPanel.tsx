// filepath: src/pages/DeviceSettings/components/LoadGroupPanel.tsx
import React from 'react';
import type { PermissionsGroup } from 'src/types';
import { Button } from 'src/components/ui';

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
      <label className="block text-sm font-medium text-text mb-1">
        {t('form.permissionsGroup')}
      </label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-lightgray rounded-lg text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">{t('form.selectPermissions')}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={onLoad}>
          {t('form.apply')}
        </Button>
      </div>
    </div>
  );
};
