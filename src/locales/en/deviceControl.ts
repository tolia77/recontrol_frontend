const deviceControl = {
  sidebar: {
    control: 'Control',
    mode: 'Mode',
    interactive: 'Interactive',
    manual: 'Manual',
    power: 'Power',
    terminal: 'Terminal',
    processes: 'Processes',
    device: 'Device'
  },
  manual: {
    tabs: {
      mouse: 'Mouse',
      keyboard: 'Keyboard',
      power: 'Power',
      terminal: 'Terminal'
    },
    mouse: {
      title: 'Manual Mouse Controls',
      position: 'Mouse Position',
      moveBtn: 'Move to (X, Y)',
      buttons: 'Mouse Buttons',
      left: 'Left Button',
      right: 'Right Button',
      middle: 'Middle Button',
      down: 'Down',
      up: 'Up',
      click: 'Click',
      double: 'Double',
      scroll: 'Mouse Scroll',
      scrollClicks: 'Scroll clicks',
      scrollUp: 'Scroll Up',
      scrollDown: 'Scroll Down'
    },
    keyboard: {
      title: 'Manual Keyboard Controls',
      singleKey: 'Single Key',
      keyLabel: 'Key (virtual key name or single char)',
      keyDown: 'Key Down',
      keyUp: 'Key Up',
      keyPress: 'Key Press',
      typeText: 'Type Text',
      textToType: 'Text to type (each character sent as key press)',
      clear: 'Clear'
    },
    power: {
      title: 'Manual Power Controls',
      warning: 'Warning: These actions will affect the remote device immediately',
      shutdown: 'Shutdown',
      restart: 'Restart',
      sleep: 'Sleep',
      hibernate: 'Hibernate',
      logOff: 'Log Off',
      lock: 'Lock',
      shutdownDesc: 'Turn off the device',
      restartDesc: 'Reboot the device',
      sleepDesc: 'Put device to sleep mode',
      hibernateDesc: 'Hibernate the device',
      logOffDesc: 'Log off current user',
      lockDesc: 'Lock the device'
    },
    terminal: {
      title: 'Manual Terminal Controls',
      commandExec: 'Command Execution',
      cmdCommand: 'CMD Command',
      timeoutMs: 'Timeout (ms)',
      execCmd: 'Execute CMD',
      psCommand: 'PowerShell Command',
      execPs: 'Execute PowerShell',
      abort: 'Abort Running Command',
      processMgmt: 'Process Management',
      listProcesses: 'List All Processes',
      killPid: 'Kill Process by PID',
      kill: 'Kill',
      startProcess: 'Start Process',
      startProcessPlaceholder: 'C:/Windows/System32/notepad.exe',
      argsOptional: 'Arguments (optional)',
      filePlaceholder: 'file.txt',
      directoryInfo: 'Directory & System Info',
      getCwd: 'Get Current Directory',
      setCwdLabel: 'Set Current Directory',
      setBtn: 'Set',
      whoAmI: 'Who Am I',
      getUptime: 'Get Uptime',
      output: 'Output',
      outputEmpty: 'No output yet',
      processesModal: {
        title: 'Processes',
        close: 'Close',
        loading: 'Loading processes...',
        empty: 'No processes found',
        pid: 'PID',
        name: 'Name',
        memory: 'Memory',
        cpuTime: 'CPU Time',
        startTime: 'Start Time',
        actions: 'Actions',
        refresh: 'Refresh',
        headerTooltip: 'Process management actions'
      }
    },
    quick: {
      startStream: 'Start Screen Stream',
      stopStream: 'Stop Screen Stream'
    }
  }
};
export default deviceControl;
