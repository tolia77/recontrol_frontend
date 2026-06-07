import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";

type PowerCommand =
  | "power.shutdown"
  | "power.restart"
  | "power.sleep"
  | "power.hibernate"
  | "power.logOff"
  | "power.lock";

const ManualPowerControls: React.FC<{
  disabled: boolean;
  addAction?: (action: any) => void;
}> = ({ disabled, addAction }) => {
  const { t } = useTranslation("deviceControl");

  const POWER_COMMANDS: {
    command: PowerCommand;
    label: string;
    description: string;
    variant: "danger" | "warning" | "info";
  }[] = [
    {
      command: "power.shutdown",
      label: t("manual.power.shutdown"),
      description: t("manual.power.shutdownDesc"),
      variant: "danger",
    },
    {
      command: "power.restart",
      label: t("manual.power.restart"),
      description: t("manual.power.restartDesc"),
      variant: "warning",
    },
    {
      command: "power.sleep",
      label: t("manual.power.sleep"),
      description: t("manual.power.sleepDesc"),
      variant: "info",
    },
    {
      command: "power.hibernate",
      label: t("manual.power.hibernate"),
      description: t("manual.power.hibernateDesc"),
      variant: "info",
    },
    {
      command: "power.logOff",
      label: t("manual.power.logOff"),
      description: t("manual.power.logOffDesc"),
      variant: "warning",
    },
    {
      command: "power.lock",
      label: t("manual.power.lock"),
      description: t("manual.power.lockDesc"),
      variant: "info",
    },
  ];

  const sendPowerCommand = useCallback(
    (command: PowerCommand) => {
      if (!addAction || disabled) return;
      addAction({
        id: crypto.randomUUID(),
        type: command,
        payload: {},
      });
    },
    [addAction, disabled],
  );

  const getButtonClass = (variant: "danger" | "warning" | "info") => {
    const base =
      "w-full py-3 px-4 rounded-md font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
    switch (variant) {
      case "danger":
        return `${base} bg-destructive hover:bg-destructive-hover active:bg-destructive-active text-white`;
      case "warning":
        return `${base} bg-warning hover:bg-warning/80 active:bg-warning/90 text-white`;
      case "info":
        return `${base} bg-primary hover:bg-primary-hover active:bg-primary-active text-white`;
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-foreground mb-4 text-heading font-semibold">
        {t("manual.power.title")}
      </h3>

      <div className="border-border bg-surface rounded-md border p-4">
        <p className="text-muted-foreground mb-4 text-body">
          ⚠️ {t("manual.power.warning")}
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {POWER_COMMANDS.map(({ command, label, description, variant }) => (
            <div key={command} className="flex flex-col">
              <button
                className={getButtonClass(variant)}
                disabled={disabled}
                onClick={() => sendPowerCommand(command)}
              >
                {label}
              </button>
              <span className="text-muted-foreground mt-1 text-center text-caption">
                {description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ManualPowerControls;
