import { useTranslation } from "react-i18next";
import { FolderIcon } from "./icons";

/**
 * Empty-state rendered when `files.listRoots` resolves to an empty array. The
 * CTA button is intentionally a no-op -- the user is in the browser and cannot
 * open the desktop's Settings window. The copy tells them to ask the desktop
 * user.
 */
function FileManagerEmptyAllowlist() {
  const { t } = useTranslation("fileManager");
  return (
    <div className="bg-surface flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <div className="relative mb-4">
        <FolderIcon className="text-border h-20 w-20" />
        <div className="bg-destructive absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full text-body-lg font-bold text-white">
          !
        </div>
      </div>
      <h3 className="text-foreground mb-2 text-heading font-semibold">
        {t("emptyAllowlist.title")}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md text-body">
        {t("emptyAllowlist.description")}
      </p>
      <button
        type="button"
        disabled
        title={t("emptyAllowlist.ctaTooltip")}
        className="bg-primary cursor-not-allowed rounded-md px-4 py-2 text-body font-medium text-white opacity-50"
      >
        {t("emptyAllowlist.cta")}
      </button>
    </div>
  );
}

export default FileManagerEmptyAllowlist;
