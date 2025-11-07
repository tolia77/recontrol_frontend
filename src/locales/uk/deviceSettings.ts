const deviceSettings = {
  title: 'Налаштування пристрою',
  subtitle: 'Керуйте деталями та доступом',
  info: {
    section: 'Інформація про пристрій',
    nameLabel: 'Назва пристрою',
    cancel: 'Скасувати',
    save: 'Зберегти зміни',
    updated: 'Пристрій успішно оновлено',
    updateError: 'Не вдалося оновити пристрій'
  },
  sharing: {
    section: 'Спільний доступ',
    invite: 'Запросити користувача',
    cancelInvite: 'Скасувати',
    emailRequired: 'Потрібна ел. пошта',
    nameRequired: 'Потрібна назва групи дозволів',
    noShares: 'Ще немає спільного доступу',
    userInvited: 'Користувача запрошено',
    inviteError: 'Не вдалося надіслати запрошення',
    removeConfirm: 'Видалити доступ цього користувача?',
    removeError: 'Не вдалося видалити доступ',
    permissions: 'Дозволи',
    expires: 'Діє до',
    defaultGroup: 'За замовчуванням',
    remove: 'Видалити'
  },
  form: {
    userEmail: 'Ел. пошта користувача',
    createNewGroup: 'Створити нову групу дозволів',
    permissionsGroup: 'Група дозволів',
    selectPermissions: 'Виберіть дозволи...',
    newGroupName: 'Назва нової групи',
    expiresAt: 'Діє до',
    sendInvitation: 'Надіслати запрошення',
    perms: {
      see_screen: 'Бачити екран',
      see_system_info: 'Бачити системну інформацію',
      access_mouse: 'Керувати мишею',
      access_keyboard: 'Керувати клавіатурою',
      access_terminal: 'Доступ до термінала',
      manage_power: 'Керування живленням'
    },
    loadGroup: 'Завантажити групу дозволів',
    saveGroup: 'Зберегти групу дозволів',
    loadedGroup: 'Дозволи завантажено з групи',
    groupSaved: 'Групу дозволів збережено',
    groupSaveError: 'Не вдалося зберегти групу дозволів',
    cloneSuffix: '(копія)',
    apply: 'Застосувати'
  },
  errors: {
    loadDetails: 'Не вдалося завантажити дані пристрою'
  },
  loading: 'Завантаження...',
  notFound: 'Пристрій не знайдено',
};
export default deviceSettings;
