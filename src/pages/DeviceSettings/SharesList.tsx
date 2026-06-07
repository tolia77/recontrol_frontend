import React from "react";
import type { SharesListProps } from "./types";
import Button from "src/components/ui/Button";

const SharesList: React.FC<SharesListProps> = ({
  t,
  shares,
  onDelete,
  onEdit,
}) => {
  return (
    <div className="space-y-3">
      {shares.length === 0 ? (
        <p className="py-4 text-center text-muted-foreground">
          {t("sharing.noShares")}
        </p>
      ) : (
        shares.map((share) => (
          <div
            key={share.id}
            className="flex items-center justify-between rounded-md border border-border p-3"
          >
            <div>
              <p className="font-medium">
                {share.user?.username || share.user?.email}
              </p>
              <p className="text-body text-muted-foreground">
                {t("sharing.permissions")}:{" "}
                {share.permissions_group?.name || t("sharing.defaultGroup")}
                {share.expires_at &&
                  ` • ${t("sharing.expires")}: ${new Date(share.expires_at).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onEdit(share)}>
                {t("sharing.edit")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(share.id)}
              >
                {t("sharing.remove")}
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default SharesList;
