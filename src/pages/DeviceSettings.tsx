// src/pages/DeviceSettings.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { backendInstance } from 'src/services/backend/config.ts';
import { getAccessToken } from 'src/utils/auth.ts';
import type { Device, DeviceShare, PermissionsGroup } from 'src/types/global';

const DeviceSettings: React.FC = () => {
    const { deviceId } = useParams<{ deviceId: string }>();
    const navigate = useNavigate();
    const [device, setDevice] = useState<Device | null>(null);
    const [shares, setShares] = useState<DeviceShare[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'details' | 'sharing'>('details');

    // Form states
    const [deviceForm, setDeviceForm] = useState({
        name: '',
        status: 'active'
    });
    const [shareForm, setShareForm] = useState({
        userEmail: '',
        permissionsGroupId: '',
        expiresAt: '',
        status: 'active'
    });
    const [permissionsGroups, setPermissionsGroups] = useState<PermissionsGroup[]>([]);
    const [showShareForm, setShowShareForm] = useState(false);

    useEffect(() => {
        if (deviceId) {
            loadDeviceData();
            loadShares();
            loadPermissionsGroups();
        }
    }, [deviceId]);

    const loadDeviceData = async () => {
        try {
            const response = await backendInstance.get(`/devices/${deviceId}`, {
                headers: { Authorization: getAccessToken() }
            });
            setDevice(response.data);
            setDeviceForm({
                name: response.data.name,
                status: response.data.status
            });
        } catch (err) {
            setError('Failed to load device details');
        } finally {
            setLoading(false);
        }
    };

    const loadShares = async () => {
        try {
            const response = await backendInstance.get('/device_shares', {
                params: { device_id: deviceId },
                headers: { Authorization: getAccessToken() }
            });
            setShares(response.data.items || []);
        } catch (err) {
            console.error('Failed to load shares:', err);
        }
    };

    const loadPermissionsGroups = async () => {
        try {
            const response = await backendInstance.get('/permissions_groups', {
                headers: { Authorization: getAccessToken() }
            });
            setPermissionsGroups(response.data.items || []);
        } catch (err) {
            console.error('Failed to load permissions groups:', err);
        }
    };

    const handleDeviceUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await backendInstance.patch(`/devices/${deviceId}`, {
                device: deviceForm
            }, {
                headers: { Authorization: getAccessToken() }
            });
            setDevice(response.data);
            alert('Device updated successfully');
        } catch (err) {
            setError('Failed to update device');
        }
    };

    const handleShareSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await backendInstance.post('/device_shares', {
                device_share: {
                    device_id: deviceId,
                    user_email: shareForm.userEmail, // send email directly
                    permissions_group_id: shareForm.permissionsGroupId || undefined,
                    expires_at: shareForm.expiresAt || undefined,
                    status: shareForm.status
                }
            }, {
                headers: { Authorization: getAccessToken() }
            });

            setShareForm({
                userEmail: '',
                permissionsGroupId: '',
                expiresAt: '',
                status: 'active'
            });
            setShowShareForm(false);
            loadShares();
            alert('User invited successfully');
        } catch (err) {
            setError('Failed to invite user');
        }
    };

    const handleDeleteShare = async (shareId: string) => {
        if (confirm('Are you sure you want to remove this share?')) {
            try {
                await backendInstance.delete(`/device_shares/${shareId}`, {
                    headers: { Authorization: getAccessToken() }
                });
                loadShares();
            } catch (err) {
                setError('Failed to remove share');
            }
        }
    };

    if (loading) return <div className="p-6">Loading...</div>;
    if (error) return <div className="p-6 text-red-500">{error}</div>;
    if (!device) return <div className="p-6">Device not found</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-text">Device Settings</h1>
                <p className="text-gray-600">Manage device details and sharing</p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'details'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Device Details
                    </button>
                    <button
                        onClick={() => setActiveTab('sharing')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'sharing'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Sharing
                    </button>
                </nav>
            </div>

            {/* Device Details Tab */}
            {activeTab === 'details' && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">Device Information</h2>
                    <form onSubmit={handleDeviceUpdate}>
                        <div className="grid grid-cols-1 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Device Name
                                </label>
                                <input
                                    type="text"
                                    value={deviceForm.name}
                                    onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select
                                    value={deviceForm.status}
                                    onChange={(e) => setDeviceForm({ ...deviceForm, status: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => navigate('/devices')}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Sharing Tab */}
            {activeTab === 'sharing' && (
                <div className="space-y-6">
                    {/* Invite User Section */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold">Shared With</h2>
                            <button
                                onClick={() => setShowShareForm(!showShareForm)}
                                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                            >
                                {showShareForm ? 'Cancel' : 'Invite User'}
                            </button>
                        </div>

                        {showShareForm && (
                            <form onSubmit={handleShareSubmit} className="mb-6 p-4 border border-gray-200 rounded-lg">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            User Email
                                        </label>
                                        <input
                                            type="email"
                                            value={shareForm.userEmail}
                                            onChange={(e) => setShareForm({ ...shareForm, userEmail: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Permissions Group
                                        </label>
                                        <select
                                            value={shareForm.permissionsGroupId}
                                            onChange={(e) => setShareForm({ ...shareForm, permissionsGroupId: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            <option value="">Select permissions...</option>
                                            {permissionsGroups.map((group) => (
                                                <option key={group.id} value={group.id}>
                                                    {group.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Expires At
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={shareForm.expiresAt}
                                            onChange={(e) => setShareForm({ ...shareForm, expiresAt: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Status
                                        </label>
                                        <select
                                            value={shareForm.status}
                                            onChange={(e) => setShareForm({ ...shareForm, status: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                                    >
                                        Send Invitation
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Shares List */}
                        <div className="space-y-3">
                            {shares.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No users have been shared with this device</p>
                            ) : (
                                shares.map((share) => (
                                    <div key={share.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                                        <div>
                                            <p className="font-medium">{share.user?.username || share.user?.email}</p>
                                            <p className="text-sm text-gray-500">
                                                Permissions: {share.permissions_group?.name || 'Default'}
                                                {share.expires_at && ` • Expires: ${new Date(share.expires_at).toLocaleDateString()}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteShare(share.id)}
                                            className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-md"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeviceSettings;