import { useTranslation } from "react-i18next";
import { formatBytes } from "./utils/formatters";

interface FileManagerStatusBarProps {
  totalCount: number;
  /** In 10-02 selectionCount is always 0; plan 10-03 wires it for real. */
  selectionCount: number;
  selectionSize: number;
}

export function FileManagerStatusBar({
  totalCount,
  selectionCount,
  selectionSize,
}: FileManagerStatusBarProps) {
  const { t } = useTranslation("fileManager");
  const hasSelection = selectionCount > 0;
  return (
    <footer
      role="status"
      className="border-lightgray text-darkgray bg-background flex-shrink-0 border-t px-3 py-1.5 text-sm"
    >
      {hasSelection ? (
        <span>
          {t("statusBar.itemsSelected", {
            count: selectionCount,
            size: formatBytes(selectionSize),
          })}
        </span>
      ) : (
        <span>{t("statusBar.items", { count: totalCount })}</span>
      )}
    </footer>
  );
}
