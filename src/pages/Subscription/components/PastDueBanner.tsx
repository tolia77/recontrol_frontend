import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import Banner from "src/components/ui/Banner";
import { useSubscription } from "src/contexts/SubscriptionContext";

function PastDueBanner() {
  const { status } = useSubscription();
  const { t } = useTranslation("subscription");

  if (status?.state !== "past_due") return null;

  return (
    <Banner
      variant="error"
      action={
        <Link to="/subscription" className="font-medium underline">
          {t("pastDue.cta")}
        </Link>
      }
    >
      {t("pastDue.message")}
    </Banner>
  );
}

export default PastDueBanner;
