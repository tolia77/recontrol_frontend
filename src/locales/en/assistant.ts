const assistant = {
  sidebar: {
    toggle: 'Assistant',
  },
  toggle: {
    open: 'Open assistant',
    close: 'Close assistant',
  },
  panel: {
    title: 'Assistant',
    placeholder: 'Ask the assistant to act on this device…',
    connection_lost: 'Connection lost to the assistant. Please refresh and try again.',
    status: {
      idle: 'Idle',
      streaming: 'Working…',
      awaiting_confirmation: 'Awaiting confirmation',
      halted_quota: 'Daily quota reached',
      error: 'Error',
    },
  },
  header: {
    step: 'Step {{n}} / {{max}}',
    stop: 'Stop',
    copy: 'Copy as Markdown',
    copySuccess: 'Transcript copied to clipboard',
    copyError: 'Could not copy to clipboard',
  },
  idle: {
    greeting: 'What can I help with on {{deviceName}}?',
    hint: 'Press Enter to send. Stop or Ctrl+Shift+A to interrupt.',
  },
  input: {
    placeholder: 'Ask the assistant to act on this device…',
    send: 'Send',
    disabledTooltip: 'Waiting for agent — press Stop to interrupt',
    waitingTooltip: 'Waiting for agent — press Stop to interrupt',
    halted_quota: {
      inlineMessage: 'Daily quota reached — resets at 00:00 UTC (in {{hh}}h {{mm}}m)',
    },
  },
  placeholder: 'Ask the assistant to act on this device…',
  tool: {
    label: 'Tool call',
    badge: {
      pending: 'Pending',
      running: 'Running',
      done: 'Done',
      error: 'Error',
      denied: 'Denied',
    },
    body: {
      expand: 'show output',
      collapse: 'hide output',
      showAll: 'show all',
      truncated: 'Showing first 200 lines of {{total}}',
    },
    elapsed: 'ran in {{seconds}}s',
  },
  toolCall: {
    status: {
      awaiting_confirmation: 'Awaiting confirmation',
      pending: 'Pending',
      running: 'Running',
      done: 'Done',
      error: 'Error',
      denied: 'Denied',
    },
    elapsed: 'ran in {{seconds}}s',
    showOutput: 'show output',
    showAll: 'show all',
    placeholderAwaiting: 'awaiting confirmation',
  },
  confirmation: {
    allowOnce: 'Allow once',
    deny: 'Deny',
    reason: 'Reason',
    zone: {
      outside_list: 'Outside allow-list',
      deny_list: 'Deny-list',
    },
    reasons: {
      outside_list: 'This command is outside the safe-list and needs your approval.',
      deny_list: 'This command is on the deny-list and needs explicit approval.',
      destructive_tool: 'This action is destructive and needs your approval.',
    },
  },
  quota: {
    warningToast: "You've used 80% of today's AI quota.",
    halted: 'Daily quota reached — resets at 00:00 UTC (in {{hours}}h {{minutes}}m)',
  },
  errors: {
    connectionLost: 'Connection lost to the assistant. Please refresh and try again.',
  },
};

export default assistant;
