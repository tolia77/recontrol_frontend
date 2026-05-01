import { useTranslation } from 'react-i18next';
import { FolderIcon } from './icons';

/**
 * ALLOW-05 empty-state. Rendered when `files.listRoots` resolves to an empty
 * array. The CTA button is intentionally a no-op -- the user is in the
 * browser and cannot open the desktop's Settings window. The copy tells them
 * to ask the desktop user (CONTEXT locked).
 */
export function FileManagerEmptyAllowlist() {
  const { t } = useTranslation('fileManager');
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 bg-background">
      <div className="relative mb-4">
        <FolderIcon className="w-20 h-20 text-lightgray" />
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-error flex items-center justify-center text-white text-lg font-bold shadow">
          !
        </div>
      </div>
      <h3 className="text-lg font-semibold text-text mb-2">
        {t('emptyAllowlist.title')}
      </h3>
      <p className="text-sm text-darkgray max-w-md mb-6">
        {t('emptyAllowlist.description')}
      </p>
      <button
        type="button"
        disabled
        title={t('emptyAllowlist.ctaTooltip')}
        className="px-4 py-2 rounded-lg bg-secondary text-white text-sm font-medium opacity-50 cursor-not-allowed"
      >
        {t('emptyAllowlist.cta')}
      </button>
    </div>
  );
}
