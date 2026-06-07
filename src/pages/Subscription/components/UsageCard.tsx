import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import Card from "src/components/ui/Card";
import CardHeader from "src/components/ui/CardHeader";
import { LoadingState } from "src/components/ui";
import { useSubscription } from "src/contexts/SubscriptionContext";
import UsageBar from "./UsageBar";

function UsageCard() {
  const { t } = useTranslation("subscription");
  const navigate = useNavigate();
  const { usage, loading } = useSubscription();

  const handleUpgradeClick = () => {
    void navigate("/subscription");
  };

  if (loading) return <LoadingState />;

  return (
    <Card padding="md">
      <CardHeader title={t("usage.heading")} />
      <div className="flex flex-col gap-4 mt-4">
        <UsageBar
          label={t("usage.devices")}
          used={usage?.devices_used ?? 0}
          limit={usage?.device_limit ?? null}
          onUpgradeClick={handleUpgradeClick}
        />
        <UsageBar
          label={t("usage.scenarios")}
          used={usage?.scenarios_used ?? 0}
          limit={usage?.scenario_limit ?? null}
          onUpgradeClick={handleUpgradeClick}
        />
        <UsageBar
          label={t("usage.aiTokens")}
          used={usage?.ai_tokens_used ?? 0}
          limit={usage?.ai_token_limit ?? null}
          onUpgradeClick={handleUpgradeClick}
        />
        <UsageBar
          label={t("usage.aiDrafts")}
          used={usage?.ai_drafts_used ?? 0}
          limit={usage?.ai_draft_limit ?? null}
          onUpgradeClick={handleUpgradeClick}
        />

        {/* Device sharing state line (boolean, no bar) */}
        <div className="flex justify-between text-body">
          <span>{t("usage.deviceSharing")}</span>
          <span className={usage?.device_sharing ? "text-success" : "text-muted-foreground"}>
            {usage?.device_sharing
              ? t("usage.sharingEnabled")
              : t("usage.sharingDisabled")}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default UsageCard;
