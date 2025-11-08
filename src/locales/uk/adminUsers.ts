const adminUsers = {
  title: 'Керування користувачами',
  subtitle: 'Створення, оновлення та видалення користувачів',
  table: {
    username: 'Імʼя користувача',
    email: 'Email',
    role: 'Роль',
    created: 'Створено',
    updated: 'Оновлено',
    actions: 'Дії',
    edit: 'Редагувати',
    save: 'Зберегти',
    cancel: 'Скасувати',
    delete: 'Видалити'
  },
  create: {
    title: 'Створити користувача',
    username: 'Імʼя користувача',
    email: 'Email',
    password: 'Пароль',
    role: 'Роль',
    submit: 'Створити'
  },
  roles: {
    admin: 'Адмін',
    user: 'Користувач'
  },
  messages: {
    loading: 'Завантаження користувачів...',
    empty: 'Користувачів не знайдено.',
    creating: 'Створення...',
    updating: 'Оновлення...',
    deleting: 'Видалення...',
    deleteConfirm: 'Ви впевнені, що хочете видалити цього користувача?',
    saved: 'Успішно збережено',
    created: 'Користувача створено',
    deleted: 'Користувача видалено'
  },
  errors: {
    forbidden: 'Заборонено',
    loadFailed: 'Не вдалося завантажити користувачів',
    saveFailed: 'Не вдалося зберегти',
    createFailed: 'Не вдалося створити користувача',
    deleteFailed: 'Не вдалося видалити користувача'
  }
};
export default adminUsers;

