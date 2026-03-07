import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import './UserList.css';

const UserList = ({ onSelect, onClose, currentUserId }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const { onlineUsers } = useSocket();

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data } = await api.get('/user/getAllUsers');
                setUsers(data.data.filter(u => u._id !== currentUserId));
            } catch (error) {
                console.error('Error fetching users:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [currentUserId]);

    const filteredUsers = users.filter(u => {
        const q = search.toLowerCase();
        return (
            u.firstName?.toLowerCase().includes(q) ||
            u.lastName?.toLowerCase().includes(q) ||
            u.userName?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
        );
    });

    const isOnline = (userId) => onlineUsers.includes(userId);

    return (
        <div className="user-list-overlay" onClick={onClose}>
            <div className="user-list-modal" onClick={e => e.stopPropagation()}>
                <div className="user-list-header">
                    <h3>Start a new chat</h3>
                    <button className="close-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="user-list-search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="user-list-content">
                    {loading ? (
                        <div className="user-list-loading">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="user-skeleton">
                                    <div className="skeleton-avatar"></div>
                                    <div className="skeleton-text">
                                        <div className="skeleton-line skeleton-line--short"></div>
                                        <div className="skeleton-line skeleton-line--long"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="user-list-empty">
                            <p>No users found</p>
                        </div>
                    ) : (
                        filteredUsers.map(user => (
                            <div
                                key={user._id}
                                className="user-list-item"
                                onClick={() => onSelect(user._id)}
                            >
                                <div className="user-avatar">
                                    <div className="avatar-circle">
                                        {user.firstName?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    {isOnline(user._id) && <span className="online-dot"></span>}
                                </div>
                                <div className="user-details">
                                    <span className="user-name">{user.firstName} {user.lastName}</span>
                                    <span className="user-username">@{user.userName}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserList;
