// filepath: src/pages/DeviceSettings/components/PermissionsEditor.tsx
import React from 'react';

export interface PermissionsEditorProps {
  t: any;
  value: {
    see_screen: boolean;
    see_system_info: boolean;
    access_mouse: boolean;
    access_keyboard: boolean;
    access_terminal: boolean;
    manage_power: boolean;
  };
  onChange: (next: PermissionsEditorProps['value']) => void;
}

export const PermissionsEditor: React.FC<PermissionsEditorProps> = ({ t, value, onChange }) => {
  const toggle = (key: keyof PermissionsEditorProps['value']) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [key]: e.target.checked });
  };

  const items = [
    { key: 'see_screen', label: t('form.perms.see_screen') },
    { key: 'see_system_info', label: t('form.perms.see_system_info') },
    { key: 'access_mouse', label: t('form.perms.access_mouse') },
    { key: 'access_keyboard', label: t('form.perms.access_keyboard') },
    { key: 'access_terminal', label: t('form.perms.access_terminal') },
    { key: 'manage_power', label: t('form.perms.manage_power') },
  ] as const;

  return (
    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((perm) => (
        <label key={perm.key} className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            checked={value[perm.key]}
            onChange={toggle(perm.key)}
            className="h-4 w-4"
          />
          <span className="text-sm text-gray-700">{perm.label}</span>
        </label>
      ))}
    </div>
  );
};

