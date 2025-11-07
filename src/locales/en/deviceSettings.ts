const deviceSettings = {
  title: 'Device Settings',
  subtitle: 'Manage device details and sharing',
  info: {
    section: 'Device Information',
    nameLabel: 'Device Name',
    cancel: 'Cancel',
    save: 'Save Changes',
    updated: 'Device updated successfully',
    updateError: 'Failed to update device'
  },
  sharing: {
    section: 'Shared With',
    invite: 'Invite User',
    cancelInvite: 'Cancel',
    emailRequired: 'Email is required',
    nameRequired: 'Permission group name is required',
    noShares: 'No users have been shared with this device',
    userInvited: 'User invited successfully',
    inviteError: 'Failed to invite user',
    removeConfirm: 'Are you sure you want to remove this share?',
    removeError: 'Failed to remove share',
    permissions: 'Permissions',
    expires: 'Expires',
    defaultGroup: 'Default',
    remove: 'Remove',
    edit: 'Edit',
    editShare: 'Edit Share',
    cancelEdit: 'Cancel',
    saveChanges: 'Save Changes',
    updateShareError: 'Failed to update share'
  },
  form: {
    userEmail: 'User Email',
    createNewGroup: 'Create new permissions group',
    permissionsGroup: 'Permissions Group',
    selectPermissions: 'Select permissions...',
    newGroupName: 'New Group Name',
    expiresAt: 'Expires At',
    sendInvitation: 'Send Invitation',
    perms: {
      see_screen: 'See screen',
      see_system_info: 'See system info',
      access_mouse: 'Access mouse',
      access_keyboard: 'Access keyboard',
      access_terminal: 'Access terminal',
      manage_power: 'Manage power'
    },
    loadGroup: 'Load permissions group',
    saveGroup: 'Save permissions group',
    loadedGroup: 'Permissions loaded from group',
    groupSaved: 'Permissions group saved',
    groupSaveError: 'Failed to save permissions group',
    cloneSuffix: '(copy)',
    apply: 'Apply'
  },
  errors: {
    loadDetails: 'Failed to load device details'
  },
  loading: 'Loading...',
  notFound: 'Device not found',
};
export default deviceSettings;
