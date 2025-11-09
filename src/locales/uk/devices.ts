const devices = {
  title: 'Пристрої',
  table: {
    name: 'Назва',
    status: 'Статус',
    lastSeen: 'Останній вхід',
    owner: 'Власник',
    actions: 'Дії',
    statusActive: 'Активний',
    statusInactive: 'Неактивний',
    never: 'Ніколи',
    unknown: 'Невідомо',
    connect: 'Підключити',
    settings: 'Налаштування',
    delete: 'Видалити',
    deleteConfirm: 'Видалити цей пристрій?',
    deleteError: 'Не вдалося видалити пристрій'
  },
  filters: {
    nameLabel: 'Пошук назви',
    namePlaceholder: 'Введіть для пошуку...',
    ownerLabel: 'Власник',
    ownerAny: 'Будь-який',
    ownerMe: 'Ви',
    ownerShared: 'Спільний',
    statusLabel: 'Статус',
    statusAny: 'Будь-який',
    lastFrom: 'Остання активність від',
    lastTo: 'Остання активність до',
    clear: 'Скинути фільтри',
    loading: 'Завантаження пристроїв...'
  }
};
export default devices;
