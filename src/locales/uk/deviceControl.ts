const deviceControl = {
  sidebar: {
    control: 'Керування',
    mode: 'Режим',
    interactive: 'Інтерактивний',
    manual: 'Ручний',
    power: 'Живлення',
    terminal: 'Термінал',
    processes: 'Процеси',
    device: 'Пристрій'
  },
  manual: {
    tabs: {
      mouse: 'Миша',
      keyboard: 'Клавіатура',
      power: 'Живлення',
      terminal: 'Термінал'
    },
    mouse: {
      title: 'Ручне керування мишею',
      position: 'Позиція миші',
      moveBtn: 'Перемістити до (X, Y)',
      buttons: 'Кнопки миші',
      left: 'Ліва кнопка',
      right: 'Права кнопка',
      middle: 'Середня кнопка',
      down: 'Натиснути',
      up: 'Відпустити',
      click: 'Клік',
      double: 'Подвійний',
      scroll: 'Прокрутка миші',
      scrollClicks: 'Кроки прокрутки',
      scrollUp: 'Прокрутити вгору',
      scrollDown: 'Прокрутити вниз'
    },
    keyboard: {
      title: 'Ручне керування клавіатурою',
      singleKey: 'Окрема клавіша',
      keyLabel: 'Клавіша (віртуальна або символ)',
      keyDown: 'Натиснути',
      keyUp: 'Відпустити',
      keyPress: 'Натискання',
      typeText: 'Ввести текст',
      textToType: 'Текст для введення (кожен символ — окреме натискання)',
      clear: 'Очистити'
    },
    power: {
      title: 'Ручне керування живленням',
      warning: 'Увага: ці дії миттєво вплинуть на віддалений пристрій',
      shutdown: 'Вимкнути',
      restart: 'Перезавантажити',
      sleep: 'Сон',
      hibernate: 'Гібернація',
      logOff: 'Вийти з акаунта',
      lock: 'Заблокувати',
      shutdownDesc: 'Вимкнути пристрій',
      restartDesc: 'Перезавантажити пристрій',
      sleepDesc: 'Перевести пристрій у режим сну',
      hibernateDesc: 'Перевести пристрій у гібернацію',
      logOffDesc: 'Вийти з поточного користувача',
      lockDesc: 'Заблокувати пристрій'
    },
    terminal: {
      title: 'Ручне керування терміналом',
      commandExec: 'Виконання команд',
      cmdCommand: 'Команда CMD',
      timeoutMs: 'Тайм‑аут (мс)',
      execCmd: 'Виконати CMD',
      psCommand: 'Команда PowerShell',
      execPs: 'Виконати PowerShell',
      abort: 'Перервати команду',
      processMgmt: 'Керування процесами',
      listProcesses: 'Показати всі процеси',
      killPid: 'Завершити процес за PID',
      kill: 'Завершити',
      startProcess: 'Запустити процес',
      startProcessPlaceholder: 'C:/Windows/System32/notepad.exe',
      argsOptional: 'Аргументи (необовʼязково)',
      filePlaceholder: 'file.txt',
      directoryInfo: 'Каталог і системна інформація',
      getCwd: 'Поточний каталог',
      setCwdLabel: 'Встановити каталог',
      setBtn: 'Встановити',
      whoAmI: 'Хто я',
      getUptime: 'Час роботи системи'
    },
    quick: {
      startStream: 'Почати трансляцію екрана',
      stopStream: 'Зупинити трансляцію екрана'
    }
  }
};
export default deviceControl;

