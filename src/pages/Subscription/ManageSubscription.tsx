import { useTranslation } from "react-i18next";
import { LoadingState, ErrorState } from "src/components/ui";
import { useSubscription } from "src/contexts/SubscriptionContext";
import StatusHeader from "./components/StatusHeader";
import UsageCard from "./components/UsageCard";
import PlanCards from "./components/PlanCards";

function ManageSubscription() {
  const { t } = useTranslation("subscription");
  const { status, loading, error, refresh } = useSubscription();

  if (loading) return <LoadingState message={t("loadingStatus")} />;
  if (error)
    return (
      <ErrorState
        message={t("errorStatus", { defaultValue: error })}
        onRetry={refresh}
      />
    );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-semibold mb-6">{t("pageTitle")}</h2>
      <StatusHeader status={status} />
      <UsageCard />
      <section className="mt-8">
        <h3 className="text-xl font-semibold mb-4">{t("choosePlan")}</h3>
        <PlanCards status={status} />
      </section>
    </div>
  );
}

export default ManageSubscription;
