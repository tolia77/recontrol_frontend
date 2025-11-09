const devices = {
    title: 'Devices',
    table: {
        name: 'Name',
        status: 'Status',
        lastSeen: 'Last Seen',
        owner: 'Owner',
        actions: 'Actions',
        statusActive: 'Active',
        statusInactive: 'Inactive',
        statusUsed: 'Used',
        never: 'Never',
        unknown: 'Unknown',
        connect: 'Connect',
        settings: 'Settings',
        delete: 'Delete',
        deleteConfirm: 'Delete this device?',
        deleteError: 'Failed to delete device'
    },
    filters: {
        nameLabel: 'Search name',
        namePlaceholder: 'Type to search...',
        ownerLabel: 'Owner',
        ownerAny: 'Any',
        ownerMe: 'You',
        ownerShared: 'Shared',
        statusLabel: 'Status',
        statusAny: 'Any',
        lastFrom: 'Last seen from',
        lastTo: 'Last seen to',
        clear: 'Clear filters',
        loading: 'Loading devices...'
    }
};
export default devices;
