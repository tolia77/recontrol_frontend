import { useTranslation } from "react-i18next";
import { FolderIcon } from "./icons";

/**
 * ALLOW-05 empty-state. Rendered when `files.listRoots` resolves to an empty
 * array. The CTA button is intentionally a no-op -- the user is in the
 * browser and cannot open the desktop's Settings window. The copy tells them
 * to ask the desktop user (CONTEXT locked).
 */
function FileManagerEmptyAllowlist() {
  const { t } = useTranslation("fileManager");
  return (
    <div className="bg-background flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <div className="relative mb-4">
        <FolderIcon className="text-lightgray h-20 w-20" />
        <div className="bg-error absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-white shadow">
          !
        </div>
      </div>
      <h3 className="text-text mb-2 text-lg font-semibold">
        {t("emptyAllowlist.title")}
      </h3>
      <p className="text-darkgray mb-6 max-w-md text-sm">
        {t("emptyAllowlist.description")}
      </p>
      <button
        type="button"
        disabled
        title={t("emptyAllowlist.ctaTooltip")}
        className="bg-secondary cursor-not-allowed rounded-lg px-4 py-2 text-sm font-medium text-white opacity-50"
      >
        {t("emptyAllowlist.cta")}
      </button>
    </div>
  );
}

export default FileManagerEmptyAllowlist;
