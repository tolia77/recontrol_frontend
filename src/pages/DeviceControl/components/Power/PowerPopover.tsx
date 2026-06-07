import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { generateUUID } from "src/utils/uuid";
import { PowerIcon } from "src/pages/DeviceControl/components/icons/icons";
import type { CommandAction } from "src/pages/DeviceControl/types";

type PowerCommand =
  | "power.shutdown"
  | "power.restart"
  | "power.sleep"
  | "power.hibernate"
  | "power.logOff"
  | "power.lock";

interface PowerPopoverProps {
  addAction?: (action: CommandAction) => void;
  disabled?: boolean;
}

/**
 * Icon-only power button that opens a dropdown of the six power actions.
 * Reuses the POWER_OPTIONS / sendAction shape from the old Sidebar; commands
 * are still gated by `permissions.manage_power` via canSend() upstream — the
 * TopBar additionally hides this control entirely when the permission is absent.
 */
function PowerPopover({ addAction, disabled }: PowerPopoverProps) {
  const { t } = useTranslation("deviceControl");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const POWER_OPTIONS: { key: PowerCommand; label: string }[] = [
    { key: "power.shutdown", label: t("manual.power.shutdown") },
    { key: "power.restart", label: t("manual.power.restart") },
    { key: "power.sleep", label: t("manual.power.sleep") },
    { key: "power.hibernate", label: t("manual.power.hibernate") },
    { key: "power.logOff", label: t("manual.power.logOff") },
    { key: "power.lock", label: t("manual.power.lock") },
  ];

  const sendAction = (type: string) => {
    if (!addAction) {
      console.warn(
        "No addAction provided to PowerPopover, cannot send command",
      );
      return;
    }
    addAction({ id: generateUUID(), type, payload: {} });
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("topbar.power.title")}
        title={t("topbar.power.title")}
        className="text-muted-foreground hover:text-foreground hover:bg-primary/8 rounded-md p-2 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PowerIcon className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-surface absolute top-full right-0 z-50 mt-2 w-48 rounded-lg border p-1.5 shadow-overlay"
        >
          <h3 className="text-muted-foreground px-2 py-1 text-caption font-semibold tracking-wide uppercase">
            {t("topbar.power.title")}
          </h3>
          {POWER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="menuitem"
              onClick={() => {
                sendAction(opt.key);
                setOpen(false);
              }}
              className="text-foreground hover:bg-primary/8 w-full rounded-md px-3 py-2 text-left text-body transition-colors duration-150"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PowerPopover;
