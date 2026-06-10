export const adminDevices = {
  title: "Device Management",
  subtitle: "View and manage all devices across all users",
  table: {
    name: "Name",
    status: "Status",
    owner: "Owner",
    email: "Email",
    lastActive: "Last Active",
    actions: "Actions",
  },
  messages: {
    loading: "Loading devices...",
    empty: "No devices found.",
    deleteConfirm: {
      title: "Force Remove Device",
      body: "This will permanently remove the device from the system. The device owner will lose access. Are you sure?",
      confirm: "Force Remove",
      cancel: "Cancel",
    },
    deleted: "Device removed",
  },
  errors: {
    forbidden: "You do not have permission to view this page.",
    loadFailed: "Failed to load devices",
    deleteFailed: "Failed to remove device",
  },
  filters: {
    status: "Filter by status",
    name: "Filter by name",
    all: "All",
  },
  refreshLabel: "Refresh device list",
};
