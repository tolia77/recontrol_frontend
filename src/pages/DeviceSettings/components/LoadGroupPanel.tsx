import React from "react";
import type { PermissionsGroup } from "src/types";
import { Button } from "src/components/ui";

export interface LoadGroupPanelProps {
  t: any;
  groups: PermissionsGroup[];
  value: string;
  onChange: (id: string) => void;
  onLoad: () => void;
}

const LoadGroupPanel: React.FC<LoadGroupPanelProps> = ({
  t,
  groups,
  value,
  onChange,
  onLoad,
}) => {
  return (
    <div className="md:col-span-2">
      <label className="text-foreground mb-1 block text-body font-medium">
        {t("form.permissionsGroup")}
      </label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-border focus-visible:border-primary focus-visible:ring-primary/30 w-full rounded-sm border px-3 py-2 text-body outline-none focus-visible:ring-2"
        >
          <option value="">{t("form.selectPermissions")}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={onLoad}>
          {t("form.apply")}
        </Button>
      </div>
    </div>
  );
};

export default LoadGroupPanel;
