import React from 'react';
import type { DeviceInfoFormProps } from './types';

export const DeviceInfoForm: React.FC<DeviceInfoFormProps> = ({ t, deviceForm, onChange, onSubmit, onCancel }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">{t('info.section')}</h2>
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('info.nameLabel')}
            </label>
            <input
              type="text"
              value={deviceForm.name}
              onChange={(e) => onChange({ ...deviceForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            {t('info.cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
          >
            {t('info.save')}
          </button>
        </div>
      </form>
    </div>
  );
};
