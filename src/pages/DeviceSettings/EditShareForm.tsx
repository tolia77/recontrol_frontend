// filepath: src/pages/DeviceSettings/EditShareForm.tsx
import React, { useState } from 'react';
import type { EditShareFormProps } from './types';
import { PermissionsEditor } from './components/PermissionsEditor';
import { LoadGroupPanel } from './components/LoadGroupPanel';
import { SaveGroupPanel } from './components/SaveGroupPanel';

export const EditShareForm: React.FC<EditShareFormProps> = ({
  t,
  editForm,
  permissionsGroups,
  onChange,
  onSubmit,
  onLoadGroup,
  onSaveGroup,
  onCancel,
}) => {
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);

  return (
    <form onSubmit={onSubmit} className="mb-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">{t('sharing.editShare')}</h3>
        <button type="button" onClick={onCancel} className="text-sm text-gray-600 hover:underline">{t('sharing.cancelEdit')}</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex gap-2 md:col-span-2">
          <button
            type="button"
            onClick={() => setShowLoadPanel(!showLoadPanel)}
            className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm"
          >
            {t('form.loadGroup')}
          </button>
          <button
            type="button"
            onClick={() => setShowSavePanel(!showSavePanel)}
            className="px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
          >
            {t('form.saveGroup')}
          </button>
        </div>

        {showLoadPanel && (
          <LoadGroupPanel
            t={t}
            groups={permissionsGroups}
            value={editForm.permissionsGroupId}
            onChange={(id) => onChange({ ...editForm, permissionsGroupId: id })}
            onLoad={onLoadGroup}
          />
        )}

        {showSavePanel && (
          <SaveGroupPanel
            t={t}
            name={editForm.newGroup.name}
            onChange={(name) => onChange({ ...editForm, newGroup: { ...editForm.newGroup, name } })}
            onSave={onSaveGroup}
          />
        )}

        <PermissionsEditor
          t={t}
          value={editForm.newGroup}
          onChange={(next) => onChange({ ...editForm, newGroup: { ...editForm.newGroup, ...next } })}
        />

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('form.expiresAt')}
          </label>
          <input
            type="datetime-local"
            value={editForm.expiresAt}
            onChange={(e) => onChange({ ...editForm, expiresAt: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 border rounded-md">{t('sharing.cancelEdit')}</button>
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark">{t('sharing.saveChanges')}</button>
      </div>
    </form>
  );
};

