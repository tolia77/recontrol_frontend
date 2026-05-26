import React from "react";
import type { DeviceInfoFormProps } from "./types";
import { Input, Button } from "src/components/ui";

export const DeviceInfoForm: React.FC<DeviceInfoFormProps> = ({
  t,
  deviceForm,
  onChange,
  onSubmit,
  onCancel,
}) => {
  return (
    <div className="bg-background border-lightgray mb-6 rounded-lg border p-6 shadow">
      <h2 className="mb-4 text-lg font-semibold">{t("info.section")}</h2>
      <form onSubmit={onSubmit}>
        <div className="mb-4 grid grid-cols-1 gap-4">
          <Input
            label={t("info.nameLabel")}
            type="text"
            value={deviceForm.name}
            onChange={(e) => onChange({ ...deviceForm, name: e.target.value })}
            required
          />
        </div>
        <div className="flex justify-end space-x-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("info.cancel")}
          </Button>
          <Button type="submit">{t("info.save")}</Button>
        </div>
      </form>
    </div>
  );
};
