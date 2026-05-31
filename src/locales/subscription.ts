// EN subscription namespace
export const subscription = {
  pageTitle: "Manage Subscription",
  choosePlan: "Choose a Plan",
  loadingStatus: "Loading subscription…",
  loadingPlans: "Loading plans…",
  errorStatus: "Failed to load subscription",

  plan: {
    free: "Free",
    pro: "Pro",
    advanced: "Advanced",
    business: "Business",
  },

  price: {
    free: "Free",
    paid: "₴{{price}}/mo",
  },

  statusHeader: {
    renews: "Renews {{date}}",
    switchesToFree: "Switches to Free on {{date}}",
    state: {
      active: "Active",
      upgrading: "Upgrading",
      pending: "Pending",
      past_due: "Past Due",
      cancelled: "Cancelled",
      expired: "Expired",
    },
  },

  usage: {
    heading: "Usage",
    devices: "Devices",
    scenarios: "Scenarios",
    aiTokens: "AI Tokens",
    aiDrafts: "AI Drafts",
    deviceSharing: "Device sharing",
    sharingEnabled: "Enabled",
    sharingDisabled: "Disabled",
    unlimitedLabel: "{{used}} used · Unlimited",
    upgradeLink: "Upgrade to increase your limit",
  },

  planCard: {
    current: "Current plan",
    switchTo: "Switch to {{plan}}",
    subscribe: "Subscribe",
    upgrade: "Upgrade",
    downgrade: "Downgrade",
    cancel: "Cancel plan",
    resubscribe: "Resubscribe",
  },

  planFeature: {
    free: {
      feature1: "2 devices",
      feature2: "3 scenarios",
      feature3: "No AI drafts",
    },
    pro: {
      feature1: "10 devices",
      feature2: "20 scenarios",
      feature3: "50 AI drafts / day",
    },
    advanced: {
      feature1: "50 devices",
      feature2: "100 scenarios",
      feature3: "200 AI drafts / day",
    },
    business: {
      feature1: "Unlimited devices",
      feature2: "Unlimited scenarios",
      feature3: "Unlimited AI drafts",
    },
  },

  pendingDowngrade: {
    note: "Switching to {{plan}} on {{date}}",
  },

  confirmSubscribeTitle: "Subscribe to {{plan}}",
  confirmSubscribeBody: "You will be charged ₴{{price}}/month. Proceed to payment?",

  confirmUpgradeTitle: "Upgrade to {{plan}}",
  confirmUpgradeBody: "You will be charged ₴{{price}}/month. Proceed to payment?",

  confirmDowngradeTitle: "Downgrade to {{plan}}",
  confirmDowngradeBody:
    "Your current {{currentPlan}} plan will remain active until {{renewalDate}}, then switch to {{targetPlan}} at ₴{{price}}/month.",

  confirmCancelTitle: "Cancel your subscription?",
  confirmCancelBody:
    "Your plan remains active until {{renewalDate}}. After that you will be moved to the Free plan.",
  confirmCancelBodyNoDate:
    "After cancellation you will be moved to the Free plan.",
  confirmCancelLabel: "Yes, cancel",

  cancelImpact: {
    devices:
      "You have {{current}} devices connected — the Free plan allows {{freeLimit}}. Extra devices will be disconnected.",
    scenarios:
      "You have {{current}} scenarios — the Free plan allows {{freeLimit}}. Extra scenarios will be disabled.",
    aiDrafts:
      "You have {{current}} AI drafts used — the Free plan does not include AI drafts.",
    sharing: "Device sharing will be disabled on the Free plan.",
  },

  pastDue: {
    message:
      "Your payment is past due. Please update your payment method to keep your subscription active.",
    cta: "Manage subscription",
  },

  nudge: {
    toast: "You've reached your {{limitName}} limit. Upgrade your plan to continue.",
  },

  return: {
    loading: "Checking your subscription…",
    successHeading: "Subscription activated!",
    successBody: "You are now on the {{plan}} plan.",
    pendingHeading: "Payment is still processing",
    pendingBody:
      "Your payment is taking longer than expected. Check back shortly or refresh.",
    abandonedHeading: "Payment not completed",
    abandonedBody:
      "It looks like your payment was not completed. You can try again from the subscription page.",
    refreshCta: "Refresh",
    manageCta: "Go to subscription",
    backCta: "Back to subscription",
  },

  gate: {
    device_sharing:       { header: "Device sharing requires an upgrade" },
    device_limit:         { header: "You've reached your device limit ({{current}}/{{limit}})" },
    scenario_limit:       { header: "You've reached your scenario limit ({{current}}/{{limit}})" },
    ai_draft_daily_limit: { header: "You've reached your daily AI draft limit ({{current}}/{{limit}})" },
    ai_access:            { header: "AI assistant requires an upgrade" },
    viewPlans: "View plans",
    dismiss:   "Dismiss",
  },
};

// UK subscription namespace
export const subscription_uk = {
  pageTitle: "Керування підпискою",
  choosePlan: "Виберіть план",
  loadingStatus: "Завантаження підписки…",
  loadingPlans: "Завантаження планів…",
  errorStatus: "Не вдалося завантажити підписку",

  plan: {
    free: "Безкоштовний",
    pro: "Pro",
    advanced: "Advanced",
    business: "Business",
  },

  price: {
    free: "Безкоштовно",
    paid: "₴{{price}}/міс.",
  },

  statusHeader: {
    renews: "Поновлюється {{date}}",
    switchesToFree: "Перейде на безкоштовний план {{date}}",
    state: {
      active: "Активна",
      upgrading: "Оновлення",
      pending: "Очікує",
      past_due: "Прострочено",
      cancelled: "Скасована",
      expired: "Закінчилася",
    },
  },

  usage: {
    heading: "Використання",
    devices: "Пристрої",
    scenarios: "Сценарії",
    aiTokens: "AI-токени",
    aiDrafts: "AI-чернетки",
    deviceSharing: "Спільний доступ до пристроїв",
    sharingEnabled: "Увімкнено",
    sharingDisabled: "Вимкнено",
    unlimitedLabel: "Використано {{used}} · Без обмежень",
    upgradeLink: "Оновіть план, щоб збільшити ліміт",
  },

  planCard: {
    current: "Поточний план",
    switchTo: "Перейти на {{plan}}",
    subscribe: "Підписатися",
    upgrade: "Оновити",
    downgrade: "Знизити",
    cancel: "Скасувати план",
    resubscribe: "Поновити підписку",
  },

  planFeature: {
    free: {
      feature1: "2 пристрої",
      feature2: "3 сценарії",
      feature3: "Без AI-чернеток",
    },
    pro: {
      feature1: "10 пристроїв",
      feature2: "20 сценаріїв",
      feature3: "50 AI-чернеток / день",
    },
    advanced: {
      feature1: "50 пристроїв",
      feature2: "100 сценаріїв",
      feature3: "200 AI-чернеток / день",
    },
    business: {
      feature1: "Необмежена кількість пристроїв",
      feature2: "Необмежена кількість сценаріїв",
      feature3: "Необмежена кількість AI-чернеток",
    },
  },

  pendingDowngrade: {
    note: "Перехід на план {{plan}} відбудеться {{date}}",
  },

  confirmSubscribeTitle: "Підписатися на {{plan}}",
  confirmSubscribeBody: "З вас буде списано ₴{{price}}/місяць. Перейти до оплати?",

  confirmUpgradeTitle: "Оновити до {{plan}}",
  confirmUpgradeBody: "З вас буде списано ₴{{price}}/місяць. Перейти до оплати?",

  confirmDowngradeTitle: "Знизити до {{plan}}",
  confirmDowngradeBody:
    "Ваш поточний план {{currentPlan}} залишається активним до {{renewalDate}}, після чого перейде на {{targetPlan}} за ₴{{price}}/місяць.",

  confirmCancelTitle: "Скасувати підписку?",
  confirmCancelBody:
    "Ваш план залишається активним до {{renewalDate}}. Після цього ви перейдете на безкоштовний план.",
  confirmCancelBodyNoDate:
    "Після скасування ви перейдете на безкоштовний план.",
  confirmCancelLabel: "Так, скасувати",

  cancelImpact: {
    devices:
      "У вас підключено {{current}} пристроїв — безкоштовний план дозволяє {{freeLimit}}. Зайві пристрої будуть відключені.",
    scenarios:
      "У вас {{current}} сценаріїв — безкоштовний план дозволяє {{freeLimit}}. Зайві сценарії будуть вимкнені.",
    aiDrafts:
      "Ви використали {{current}} AI-чернеток — безкоштовний план не включає AI-чернетки.",
    sharing: "Спільний доступ до пристроїв буде вимкнено на безкоштовному плані.",
  },

  pastDue: {
    message:
      "Оплату прострочено. Будь ласка, оновіть спосіб оплати, щоб зберегти підписку.",
    cta: "Керувати підпискою",
  },

  nudge: {
    toast: "Ви досягли ліміту «{{limitName}}». Оновіть план, щоб продовжити.",
  },

  return: {
    loading: "Перевірка підписки…",
    successHeading: "Підписку активовано!",
    successBody: "Тепер ви на плані {{plan}}.",
    pendingHeading: "Оплата ще обробляється",
    pendingBody:
      "Обробка оплати займає більше часу, ніж очікувалося. Перевірте пізніше або оновіть сторінку.",
    abandonedHeading: "Оплата не завершена",
    abandonedBody:
      "Схоже, оплата не була завершена. Ви можете спробувати ще раз зі сторінки підписки.",
    refreshCta: "Оновити",
    manageCta: "Перейти до підписки",
    backCta: "Назад до підписки",
  },

  gate: {
    device_sharing:       { header: "Спільний доступ до пристроїв потребує оновлення плану" },
    device_limit:         { header: "Ви досягли ліміту пристроїв ({{current}}/{{limit}})" },
    scenario_limit:       { header: "Ви досягли ліміту сценаріїв ({{current}}/{{limit}})" },
    ai_draft_daily_limit: { header: "Ви досягли денного ліміту AI-чернеток ({{current}}/{{limit}})" },
    ai_access:            { header: "AI-асистент потребує оновлення плану" },
    viewPlans: "Переглянути плани",
    dismiss:   "Закрити",
  },
};
