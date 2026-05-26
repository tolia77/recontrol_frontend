import React, { useState } from "react";
import type { InviteShareFormProps } from "./types";
import { PermissionsEditor } from "./components/PermissionsEditor";
import { LoadGroupPanel } from "./components/LoadGroupPanel";
import { SaveGroupPanel } from "./components/SaveGroupPanel";
import { Input, Button } from "src/components/ui";

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
    <form
      onSubmit={onSubmit}
      className="border-lightgray mb-6 rounded-lg border p-4"
    >
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Input
            label={t("form.userEmail")}
            type="email"
            value={shareForm.userEmail}
            onChange={(e) =>
              onChange({ ...shareForm, userEmail: e.target.value })
            }
            required
          />
        </div>

        {/* Action buttons to reveal load/save panels */}
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
            value={shareForm.permissionsGroupId}
            onChange={(id) =>
              onChange({ ...shareForm, permissionsGroupId: id })
            }
            onLoad={onLoadGroup}
          />
        )}

        {showSavePanel && (
          <SaveGroupPanel
            t={t}
            name={shareForm.newGroup.name ?? ""}
            onChange={(name) =>
              onChange({
                ...shareForm,
                newGroup: { ...shareForm.newGroup, name },
              })
            }
            onSave={onSaveGroup}
          />
        )}

        {/* Always visible permissions editor */}
        <PermissionsEditor
          t={t}
          value={{
            see_screen: !!shareForm.newGroup.see_screen,
            see_system_info: !!shareForm.newGroup.see_system_info,
            access_mouse: !!shareForm.newGroup.access_mouse,
            access_keyboard: !!shareForm.newGroup.access_keyboard,
            access_terminal: !!shareForm.newGroup.access_terminal,
            manage_power: !!shareForm.newGroup.manage_power,
          }}
          onChange={(next) =>
            onChange({
              ...shareForm,
              newGroup: { ...shareForm.newGroup, ...next },
            })
          }
        />

        <div className="md:col-span-2">
          <Input
            label={t("form.expiresAt")}
            type="datetime-local"
            value={shareForm.expiresAt}
            onChange={(e) =>
              onChange({ ...shareForm, expiresAt: e.target.value })
            }
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit">{t("form.sendInvitation")}</Button>
      </div>
    </form>
  );
};
