export const adminSubscriptions = {
  title: "Управління підписками",
  subtitle: "Перегляд, зміна та скасування підписок користувачів",
  table: {
    owner: "Власник",
    state: "Стан",
    plan_name: "Тариф",
    period_end: "Кінець періоду",
    is_comp: "Компл.",
    created_at: "Створено",
    actions: "Дії",
  },
  messages: {
    loading: "Завантаження підписок...",
    empty: "Підписок не знайдено.",
    cancelConfirm: {
      title: "Скасувати підписку",
      body: "Користувач збереже доступ до {{periodEnd}}. Все одно скасувати підписку?",
      confirm: "Скасувати підписку",
      cancel: "Залишити",
    },
    cancelled: "Запит на скасування підписки надіслано",
    overridden: "Компліментарний тариф успішно надано",
  },
  errors: {
    forbidden: "Заборонено",
    loadFailed: "Не вдалося завантажити підписки",
    cancelFailed: "Не вдалося скасувати підписку",
    overrideFailed: "Не вдалося надати компліментарний тариф",
    billingHistoryFailed: "Не вдалося завантажити історію виставлення рахунків",
  },
  billingHistory: {
    title: "Історія виставлення рахунків",
    columns: {
      event_type: "Подія",
      from_state: "З",
      to_state: "До",
      created_at: "Дата",
    },
    empty: "Історія виставлення рахунків відсутня.",
  },
  override: {
    title: "Надати компліментарний тариф",
    userLabel: "Цільовий користувач",
    planLabel: "Тариф",
    submit: "Надати",
  },
  filters: {
    state: "Стан",
    plan: "Тариф",
    all: "Всі",
  },
  refreshLabel: "Оновити підписки",
};
