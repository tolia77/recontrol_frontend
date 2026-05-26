import React from 'react';
import type { DeviceInfoFormProps } from './types';
import { Input, Button } from 'src/components/ui';

export const DeviceInfoForm: React.FC<DeviceInfoFormProps> = ({ t, deviceForm, onChange, onSubmit, onCancel }) => {
  return (
    <div className="bg-background rounded-lg shadow p-6 mb-6 border border-lightgray">
      <h2 className="text-lg font-semibold mb-4">{t('info.section')}</h2>
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Input
            label={t('info.nameLabel')}
            type="text"
            value={deviceForm.name}
            onChange={(e) => onChange({ ...deviceForm, name: e.target.value })}
            required
          />
        </div>
        <div className="flex justify-end space-x-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('info.cancel')}
          </Button>
          <Button type="submit">
            {t('info.save')}
          </Button>
        </div>
      </form>
    </div>
  );
};
