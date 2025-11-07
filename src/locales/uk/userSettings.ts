const userSettings = {
  title: 'Налаштування користувача',
  loading: 'Завантаження користувача…',
  fields: {
    username: 'Імʼя користувача',
    email: 'Ел. пошта',
    password: 'Новий пароль',
    passwordHelp: 'залиште порожнім, щоб зберегти поточний',
    passwordPlaceholder: 'Залиште порожнім, щоб не змінювати пароль'
  },
  buttons: {
    save: 'Зберегти зміни',
    saving: 'Збереження…'
  },
  messages: {
    saved: 'Налаштування збережено.'
  },
  errors: {
    loadFailed: 'Не вдалося завантажити користувача.',
    saveFailed: 'Не вдалося зберегти зміни.',
    forbidden: 'У вас немає дозволу на цю дію.',
    notLoggedIn: 'Потрібно увійти, щоб переглянути налаштування.'
  }
};
export default userSettings;

