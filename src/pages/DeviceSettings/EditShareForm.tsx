// filepath: src/pages/DeviceSettings/EditShareForm.tsx
import React, { useState } from "react";
import type { EditShareFormProps } from "./types";
import PermissionsEditor from "./components/PermissionsEditor";
import LoadGroupPanel from "./components/LoadGroupPanel";
import SaveGroupPanel from "./components/SaveGroupPanel";
import { Input, Button } from "src/components/ui";

const EditShareForm: React.FC<EditShareFormProps> = ({
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
    <form
      onSubmit={onSubmit}
      className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{t("sharing.editShare")}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-darkgray text-sm hover:underline"
        >
          {t("sharing.cancelEdit")}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex gap-2 md:col-span-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowLoadPanel(!showLoadPanel)}
          >
            {t("form.loadGroup")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowSavePanel(!showSavePanel)}
          >
            {t("form.saveGroup")}
          </Button>
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
            name={editForm.newGroup.name ?? ""}
            onChange={(name) =>
              onChange({
                ...editForm,
                newGroup: { ...editForm.newGroup, name },
              })
            }
            onSave={onSaveGroup}
          />
        )}

        <PermissionsEditor
          t={t}
          value={{
            see_screen: !!editForm.newGroup.see_screen,
            see_system_info: !!editForm.newGroup.see_system_info,
            access_mouse: !!editForm.newGroup.access_mouse,
            access_keyboard: !!editForm.newGroup.access_keyboard,
            access_terminal: !!editForm.newGroup.access_terminal,
            manage_power: !!editForm.newGroup.manage_power,
          }}
          onChange={(next) =>
            onChange({
              ...editForm,
              newGroup: { ...editForm.newGroup, ...next },
            })
          }
        />

        <div className="md:col-span-2">
          <Input
            label={t("form.expiresAt")}
            type="datetime-local"
            value={editForm.expiresAt}
            onChange={(e) =>
              onChange({ ...editForm, expiresAt: e.target.value })
            }
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("sharing.cancelEdit")}
        </Button>
        <Button type="submit">{t("sharing.saveChanges")}</Button>
      </div>
    </form>
  );
};

export default EditShareForm;
