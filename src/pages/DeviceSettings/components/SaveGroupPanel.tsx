// filepath: src/pages/DeviceSettings/components/SaveGroupPanel.tsx
import React from "react";
import { Input, Button } from "src/components/ui";

export interface SaveGroupPanelProps {
  t: any;
  name: string;
  onChange: (name: string) => void;
  onSave: () => void;
}

export const SaveGroupPanel: React.FC<SaveGroupPanelProps> = ({
  t,
  name,
  onChange,
  onSave,
}) => {
  return (
    <div className="md:col-span-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={t("form.newGroupName")}
            type="text"
            value={name}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <Button type="button" onClick={onSave}>
          {t("form.saveGroup")}
        </Button>
      </div>
    </div>
  );
};
