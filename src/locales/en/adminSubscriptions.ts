export const adminSubscriptions = {
  title: "Subscription Management",
  subtitle: "View, override, and cancel user subscriptions",
  table: {
    owner: "Owner",
    state: "State",
    plan_name: "Plan",
    period_end: "Period End",
    is_comp: "Comp",
    created_at: "Created",
    actions: "Actions",
  },
  messages: {
    loading: "Loading subscriptions...",
    empty: "No subscriptions found.",
    cancelConfirm: {
      title: "Cancel Subscription",
      body: "The user will retain access until {{periodEnd}}. Cancel the subscription anyway?",
      confirm: "Cancel subscription",
      cancel: "Keep",
    },
    cancelled: "Subscription cancellation requested",
    overridden: "Comp plan granted successfully",
  },
  errors: {
    forbidden: "Forbidden",
    loadFailed: "Failed to load subscriptions",
    cancelFailed: "Failed to cancel subscription",
    overrideFailed: "Failed to grant comp plan",
    billingHistoryFailed: "Failed to load billing history",
  },
  billingHistory: {
    title: "Billing History",
    columns: {
      event_type: "Event",
      from_state: "From",
      to_state: "To",
      created_at: "Date",
    },
    empty: "No billing history found.",
  },
  override: {
    title: "Grant Comp Plan",
    userLabel: "Target User",
    planLabel: "Plan",
    submit: "Grant",
  },
  filters: {
    state: "State",
    plan: "Plan",
    all: "All",
  },
  refreshLabel: "Refresh subscriptions",
};
