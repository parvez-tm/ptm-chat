import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './ProfileModal.css';

const ProfileModal = ({ onClose }) => {
    const { user, updateProfile, changePassword } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Profile fields
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        userName: '',
        phone: '',
        address: ''
    });

    // Password fields
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                userName: user.userName || '',
                phone: user.phone || '',
                address: user.address || ''
            });
        }
    }, [user]);

    const showMessage = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateProfile(formData);
            showMessage('Profile updated successfully');
        } catch (err) {
            showMessage(err.response?.data?.message || 'Failed to update profile', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showMessage('Passwords do not match', 'error');
            return;
        }
        if (passwordData.newPassword.length < 6) {
            showMessage('New password must be at least 6 characters', 'error');
            return;
        }
        setLoading(true);
        try {
            await changePassword(passwordData.currentPassword, passwordData.newPassword);
            showMessage('Password changed successfully');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            showMessage(err.response?.data?.message || 'Failed to change password', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-overlay" onClick={onClose}>
            <div className="profile-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="profile-modal-header">
                    <h3>My Profile</h3>
                    <button className="close-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Avatar & Name */}
                <div className="profile-avatar-section">
                    <div className="profile-avatar">
                        {user?.firstName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="profile-name">
                        <span className="profile-fullname">{user?.firstName} {user?.lastName}</span>
                        <span className="profile-email">{user?.email}</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="profile-tabs">
                    <button
                        className={`profile-tab ${activeTab === 'profile' ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        Edit Profile
                    </button>
                    <button
                        className={`profile-tab ${activeTab === 'password' ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab('password')}
                    >
                        Change Password
                    </button>
                </div>

                {/* Message */}
                {message.text && (
                    <div className={`profile-message profile-message--${message.type}`}>
                        {message.text}
                    </div>
                )}

                {/* Profile Form */}
                {activeTab === 'profile' && (
                    <form onSubmit={handleProfileSubmit} className="profile-form">
                        <div className="profile-form-row">
                            <div className="profile-form-group">
                                <label>First Name</label>
                                <input
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="profile-form-group">
                                <label>Last Name</label>
                                <input
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>

                        <div className="profile-form-group">
                            <label>Username</label>
                            <input
                                type="text"
                                value={formData.userName}
                                onChange={(e) => setFormData(prev => ({ ...prev, userName: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="profile-form-group">
                            <label>Phone</label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="Optional"
                            />
                        </div>

                        <div className="profile-form-group">
                            <label>Address</label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="Optional"
                            />
                        </div>

                        <button type="submit" className="profile-submit-btn" disabled={loading}>
                            {loading ? <span className="btn-loader"></span> : 'Save Changes'}
                        </button>
                    </form>
                )}

                {/* Password Form */}
                {activeTab === 'password' && (
                    <form onSubmit={handlePasswordSubmit} className="profile-form">
                        <div className="profile-form-group">
                            <label>Current Password</label>
                            <input
                                type="password"
                                value={passwordData.currentPassword}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <div className="profile-form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                placeholder="Min 6 characters"
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="profile-form-group">
                            <label>Confirm New Password</label>
                            <input
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <button type="submit" className="profile-submit-btn" disabled={loading}>
                            {loading ? <span className="btn-loader"></span> : 'Change Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ProfileModal;
