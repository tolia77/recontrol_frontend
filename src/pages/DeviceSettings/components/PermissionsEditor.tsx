import React from "react";

export interface PermissionsEditorProps {
  t: any;
  value: {
    see_screen: boolean;
    access_mouse: boolean;
    access_keyboard: boolean;
    access_terminal: boolean;
    manage_power: boolean;
    access_clipboard: boolean;
    files_read: boolean;
    files_write: boolean;
  };
  onChange: (next: PermissionsEditorProps["value"]) => void;
}

const PermissionsEditor: React.FC<PermissionsEditorProps> = ({
  t,
  value,
  onChange,
}) => {
  const toggle =
    (key: keyof PermissionsEditorProps["value"]) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, [key]: e.target.checked });
    };

  const items = [
    { key: "see_screen",       label: t("form.perms.see_screen") },
    { key: "access_mouse",     label: t("form.perms.access_mouse") },
    { key: "access_keyboard",  label: t("form.perms.access_keyboard") },
    { key: "access_terminal",  label: t("form.perms.access_terminal") },
    { key: "manage_power",     label: t("form.perms.manage_power") },
    { key: "access_clipboard", label: t("form.perms.access_clipboard") },
    { key: "files_read",       label: t("form.perms.files_read") },
    { key: "files_write",      label: t("form.perms.files_write") },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2">
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

export default PermissionsEditor;
