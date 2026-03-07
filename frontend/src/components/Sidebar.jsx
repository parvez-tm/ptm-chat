import { useMemo } from 'react';
import './Sidebar.css';

const Sidebar = ({
    conversations,
    activeConversation,
    onSelectConversation,
    onNewChat,
    onLogout,
    currentUser,
    onlineUsers,
    loading,
    isOpen,
    onToggle
}) => {

    const getOtherParticipant = (conversation) => {
        return conversation.participants?.find(
            p => p._id !== currentUser?.id
        );
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const oneDay = 86400000;

        if (diff < oneDay) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diff < oneDay * 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const isUserOnline = (userId) => onlineUsers.includes(userId);

    return (
        <div className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
            {/* Header */}
            <div className="sidebar-header">
                <div className="sidebar-header-left">
                    <h2>Chats</h2>
                </div>
                <div className="sidebar-header-right">
                    <button className="icon-btn" onClick={onNewChat} title="New chat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Conversation List */}
            <div className="conversation-list">
                {loading ? (
                    <div className="sidebar-loading">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="conversation-skeleton">
                                <div className="skeleton-avatar"></div>
                                <div className="skeleton-text">
                                    <div className="skeleton-line skeleton-line--short"></div>
                                    <div className="skeleton-line skeleton-line--long"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="sidebar-empty">
                        <div className="empty-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <p>No conversations yet</p>
                        <button className="start-chat-btn" onClick={onNewChat}>Start a chat</button>
                    </div>
                ) : (
                    conversations.map(conv => {
                        const other = getOtherParticipant(conv);
                        const isActive = activeConversation?._id === conv._id;
                        const online = other && isUserOnline(other._id);

                        return (
                            <div
                                key={conv._id}
                                className={`conversation-item ${isActive ? 'conversation-item--active' : ''}`}
                                onClick={() => onSelectConversation(conv)}
                            >
                                <div className="conv-avatar">
                                    <div className="avatar-circle">
                                        {other?.firstName?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    {online && <span className="online-dot"></span>}
                                </div>
                                <div className="conv-info">
                                    <div className="conv-top">
                                        <span className="conv-name">
                                            {other ? `${other.firstName} ${other.lastName}` : 'Unknown'}
                                        </span>
                                        <span className="conv-time">
                                            {formatTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                                        </span>
                                    </div>
                                    <p className="conv-last-msg">
                                        {conv.lastMessage?.content
                                            ? (conv.lastMessage.content.length > 40
                                                ? conv.lastMessage.content.substring(0, 40) + '...'
                                                : conv.lastMessage.content)
                                            : 'No messages yet'}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* User Profile Section */}
            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="avatar-circle avatar-circle--small">
                        {currentUser?.firstName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="user-info">
                        <span className="user-name">{currentUser?.firstName} {currentUser?.lastName}</span>
                        <span className="user-status">Online</span>
                    </div>
                </div>
                <button className="icon-btn logout-btn" onClick={onLogout} title="Logout">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
