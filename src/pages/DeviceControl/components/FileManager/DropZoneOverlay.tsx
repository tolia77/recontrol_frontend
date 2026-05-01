import { useTranslation } from 'react-i18next';

/**
 * Visual-only overlay rendered while the user is dragging files over the file
 * manager's right column.
 *
 * `pointer-events: none` is load-bearing: the panel-side drop handlers fire on
 * the underlying right-column container, NOT on this overlay. Without
 * pointer-events:none, the z-40 overlay would swallow drag events and prevent
 * the drop from registering.
 *
 * Plan 11-04 sizes the overlay to the right column (sibling of toolbar /
 * breadcrumb / listing / status / queue panel). The sidebar deliberately stays
 * unobscured so the user can still read the destination context (active root +
 * shared-folders list) while dragging.
 */
export function DropZoneOverlay() {
  const { t } = useTranslation('fileManager');
  return (
    <div
      className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="bg-accent/10 border-2 border-dashed border-accent rounded-lg w-[92%] h-[92%] flex items-center justify-center">
        <p className="text-accent text-base font-medium">
          {t('dropZone.drop')}
        </p>
      </div>
    </div>
  );
}
