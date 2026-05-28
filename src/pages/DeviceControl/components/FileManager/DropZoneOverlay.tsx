import { useTranslation } from "react-i18next";

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
function DropZoneOverlay() {
  const { t } = useTranslation("fileManager");
  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="bg-accent/10 border-accent flex h-[92%] w-[92%] items-center justify-center rounded-lg border-2 border-dashed">
        <p className="text-accent text-base font-medium">
          {t("dropZone.drop")}
        </p>
      </div>
    </div>
  );
}

export default DropZoneOverlay;
