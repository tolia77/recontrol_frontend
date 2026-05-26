import React from "react";
import type { SharesListProps } from "./types";

export const SharesList: React.FC<SharesListProps> = ({
  t,
  shares,
  onDelete,
  onEdit,
}) => {
  return (
    <div className="space-y-3">
      {shares.length === 0 ? (
        <p className="py-4 text-center text-gray-500">
          {t("sharing.noShares")}
        </p>
      ) : (
        shares.map((share: any) => (
          <div
            key={share.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
          >
            <div>
              <p className="font-medium">
                {share.user?.username || share.user?.email}
              </p>
              <p className="text-sm text-gray-500">
                {t("sharing.permissions")}:{" "}
                {share.permissions_group?.name || t("sharing.defaultGroup")}
                {share.expires_at &&
                  ` • ${t("sharing.expires")}: ${new Date(share.expires_at).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(share)}
                className="rounded-md px-3 py-1 text-blue-600 hover:bg-blue-50"
              >
                {t("sharing.edit")}
              </button>
              <button
                onClick={() => onDelete(share.id)}
                className="rounded-md px-3 py-1 text-red-600 hover:bg-red-50"
              >
                {t("sharing.remove")}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
