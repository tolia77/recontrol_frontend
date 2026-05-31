import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Card, Button, LoadingState } from "src/components/ui";
import { subscriptionService } from "src/services/backend/subscriptionService";

const POLL_INTERVAL = 2000;  // ms
const POLL_TIMEOUT = 45000;  // ms (~45 s, D-07)

type Phase = "polling" | "success" | "timeout" | "abandoned";

function SubscriptionReturn() {
  const { t } = useTranslation("subscription");
  const [phase, setPhase] = useState<Phase>("polling");
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const startRef = useRef<number>(Date.now());

  // Reset the poll — used by the [Refresh] button in the timeout state
  function restartPoll() {
    startRef.current = Date.now();
    setPhase("polling");
  }

  useEffect(() => {
    if (phase !== "polling") return;

    const handle = window.setInterval(async () => {
      try {
        const status = await subscriptionService.getStatus();

        if (status.state === "active") {
          window.clearInterval(handle);
          setActivePlan(status.plan_name);
          setPhase("success");
          return;
        }

        if (status.state === "cancelled" || status.state === "expired") {
          window.clearInterval(handle);
          setPhase("abandoned");
          return;
        }

        // Check timeout (D-07)
        if (Date.now() - startRef.current >= POLL_TIMEOUT) {
          window.clearInterval(handle);
          setPhase("timeout");
        }
      } catch (err) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 404) {
          // 404 = no subscription row yet — only treat as abandoned after timeout
          if (Date.now() - startRef.current >= POLL_TIMEOUT) {
            window.clearInterval(handle);
            setPhase("abandoned");
          }
          return;
        }
        // Other errors: check timeout, then keep polling
        if (Date.now() - startRef.current >= POLL_TIMEOUT) {
          window.clearInterval(handle);
          setPhase("timeout");
        }
      }
    }, POLL_INTERVAL);

    return () => window.clearInterval(handle);
  }, [phase]);

  return (
    <div className="max-w-md mx-auto mt-16">
      <Card padding="lg">
        {phase === "polling" && (
          <LoadingState message={t("return.loading")} />
        )}

        {phase === "success" && (
          <div className="flex flex-col gap-3 text-center">
            <div className="text-accent text-5xl" aria-hidden="true">
              &#10003;
            </div>
            <h2 className="text-xl font-semibold">{t("return.successHeading")}</h2>
            <p className="text-sm text-darkgray">
              {t("return.successBody", {
                plan: activePlan ? t(`plan.${activePlan}`) : "",
              })}
            </p>
            <Link
              to="/subscription"
              className="mt-2 inline-flex items-center justify-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90"
            >
              {t("return.manageCta")}
            </Link>
          </div>
        )}

        {phase === "timeout" && (
          <div className="flex flex-col gap-3 text-center">
            <h2 className="text-xl font-semibold">{t("return.pendingHeading")}</h2>
            <p className="text-sm text-darkgray">{t("return.pendingBody")}</p>
            <div className="flex flex-col gap-3 mt-2">
              <Button
                variant="primary"
                onClick={restartPoll}
                className="w-full"
              >
                {t("return.refreshCta")}
              </Button>
              <Link
                to="/subscription"
                className="inline-flex items-center justify-center px-4 py-2 bg-background text-primary border border-lightgray text-sm font-medium rounded-lg hover:bg-tertiary"
              >
                {t("return.manageCta")}
              </Link>
            </div>
          </div>
        )}

        {phase === "abandoned" && (
          <div className="flex flex-col gap-3 text-center">
            <h2 className="text-xl font-semibold">{t("return.abandonedHeading")}</h2>
            <p className="text-sm text-darkgray">{t("return.abandonedBody")}</p>
            <Link
              to="/subscription"
              className="mt-2 inline-flex items-center justify-center px-4 py-2 bg-background text-primary border border-lightgray text-sm font-medium rounded-lg hover:bg-tertiary"
            >
              {t("return.backCta")}
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

export default SubscriptionReturn;
