export const adminAiUsage = {
  title: "AI Usage",
  subtitle: "Overview of AI token usage across users",
  summary: {
    totalTokens: "Total Tokens",
    totalSessions: "Total Sessions",
    uniqueUsers: "Unique Users",
    topModel: "Top Model",
  },
  table: {
    username: "Username",
    tokens: "Tokens",
    sessions: "Sessions",
    topModel: "Top Model",
  },
  dateFilter: {
    from: "From",
    to: "To",
  },
  messages: {
    loading: "Loading AI usage data...",
    empty: "No AI usage data found for the selected date range.",
  },
  errors: {
    forbidden: "Forbidden",
    loadFailed: "Failed to load AI usage data",
  },
  refreshLabel: "Refresh AI usage data",
};
