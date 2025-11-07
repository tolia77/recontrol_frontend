const auth = {
  login: {
    title: 'Увійдіть до свого акаунта',
    email: 'Ел. пошта',
    password: 'Пароль',
    submit: 'Увійти',
    noAccount: 'Ще немає акаунта? <signupLink>Зареєструйтесь</signupLink>',
    errors: {
      invalid: 'Неправильна ел. пошта або пароль.'
    }
  },
  signup: {
    title: 'Створіть акаунт',
    username: 'Імʼя користувача',
    email: 'Ел. пошта',
    password: 'Пароль',
    confirm: 'Підтвердження пароля',
    submit: 'Зареєструватися',
    haveAccount: 'Вже маєте акаунт? <loginLink>Увійдіть</loginLink>',
    errors: {
      invalidInput: 'Невірні дані.',
      failed: 'Реєстрація не вдалася.'
    }
  }
};
export default auth;

