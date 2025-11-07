import React, { useState } from 'react';
import type { InviteShareFormProps } from './types';
import { PermissionsEditor } from './components/PermissionsEditor';
import { LoadGroupPanel } from './components/LoadGroupPanel';
import { SaveGroupPanel } from './components/SaveGroupPanel';

export const InviteShareForm: React.FC<InviteShareFormProps> = ({
  t,
  shareForm,
  permissionsGroups,
  onChange,
  onSubmit,
  onLoadGroup,
  onSaveGroup,
}) => {
  // Local UI toggles for panels
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);

  return (
    <form onSubmit={onSubmit} className="mb-6 p-4 border border-gray-200 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('form.userEmail')}
          </label>
          <input
            type="email"
            value={shareForm.userEmail}
            onChange={(e) => onChange({ ...shareForm, userEmail: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        {/* Action buttons to reveal load/save panels */}
        <div className="flex gap-2 md:col-span-2">
          <button
            type="button"
            onClick={() => setShowLoadPanel(!showLoadPanel)}
            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {t('form.loadGroup')}
          </button>
          <button
            type="button"
            onClick={() => setShowSavePanel(!showSavePanel)}
            className="px-3 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
          >
            {t('form.saveGroup')}
          </button>
        </div>

        {showLoadPanel && (
          <LoadGroupPanel
            t={t}
            groups={permissionsGroups}
            value={shareForm.permissionsGroupId}
            onChange={(id) => onChange({ ...shareForm, permissionsGroupId: id })}
            onLoad={onLoadGroup}
          />
        )}

        {showSavePanel && (
          <SaveGroupPanel
            t={t}
            name={shareForm.newGroup.name}
            onChange={(name) => onChange({ ...shareForm, newGroup: { ...shareForm.newGroup, name } })}
            onSave={onSaveGroup}
          />
        )}

        {/* Always visible permissions editor */}
        <PermissionsEditor
          t={t}
          value={shareForm.newGroup}
          onChange={(next) => onChange({ ...shareForm, newGroup: { ...shareForm.newGroup, ...next } })}
        />

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('form.expiresAt')}
          </label>
          <input
            type="datetime-local"
            value={shareForm.expiresAt}
            onChange={(e) => onChange({ ...shareForm, expiresAt: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
        >
          {t('form.sendInvitation')}
        </button>
      </div>
    </form>
  );
};
