import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import MessageInput from './MessageInput';
import './ChatWindow.css';

const ChatWindow = ({ conversation, messages, currentUser, onlineUsers, onBackClick, hasMore, loadingMore, onLoadMore }) => {
    const { socket, markMessagesRead } = useSocket();
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const [typingUsers, setTypingUsers] = useState({});
    const prevMessagesLenRef = useRef(0);
    const isInitialLoadRef = useRef(true);

    const otherParticipant = useMemo(() => {
        if (!conversation) return null;
        return conversation.participants?.find(p => p._id !== currentUser?.id);
    }, [conversation, currentUser]);

    const isOtherOnline = otherParticipant && onlineUsers.includes(otherParticipant._id);

    // Clear typing state when conversation changes
    useEffect(() => {
        setTypingUsers({});
        isInitialLoadRef.current = true;
    }, [conversation?._id]);

    // Auto-scroll: only on initial load or when new messages arrive at the bottom
    useEffect(() => {
        if (!messages.length) return;

        const container = messagesContainerRef.current;
        if (!container) return;

        // If this is initial load or new messages appended (not prepended via pagination)
        if (isInitialLoadRef.current || messages.length > prevMessagesLenRef.current) {
            const wasNearBottom =
                isInitialLoadRef.current ||
                container.scrollHeight - container.scrollTop - container.clientHeight < 150;

            if (wasNearBottom) {
                messagesEndRef.current?.scrollIntoView({ behavior: isInitialLoadRef.current ? 'instant' : 'smooth' });
            }
            isInitialLoadRef.current = false;
        }

        prevMessagesLenRef.current = messages.length;
    }, [messages]);

    // Scroll-to-top detection for loading older messages
    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container || !hasMore || loadingMore) return;

        if (container.scrollTop < 60) {
            // Remember scroll height before prepending
            const prevScrollHeight = container.scrollHeight;
            onLoadMore();
            // After messages are prepended, restore scroll position
            requestAnimationFrame(() => {
                const newScrollHeight = container.scrollHeight;
                container.scrollTop = newScrollHeight - prevScrollHeight;
            });
        }
    }, [hasMore, loadingMore, onLoadMore]);

    // Listen for typing events
    useEffect(() => {
        if (!socket || !conversation) return;

        const handleTyping = ({ userId, conversationId }) => {
            if (conversationId === conversation._id && userId !== currentUser?.id) {
                setTypingUsers(prev => ({ ...prev, [userId]: true }));
            }
        };

        const handleStopTyping = ({ userId, conversationId }) => {
            if (conversationId === conversation._id) {
                setTypingUsers(prev => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
            }
        };

        socket.on('userTyping', handleTyping);
        socket.on('userStopTyping', handleStopTyping);

        return () => {
            socket.off('userTyping', handleTyping);
            socket.off('userStopTyping', handleStopTyping);
        };
    }, [socket, conversation, currentUser]);

    // Mark messages as read
    useEffect(() => {
        if (!conversation || !messages.length) return;

        const unreadIds = messages
            .filter(m => m.sender !== currentUser?.id && m.sender?._id !== currentUser?.id && !m.readBy?.includes(currentUser?.id))
            .map(m => m._id);

        if (unreadIds.length > 0) {
            markMessagesRead(conversation._id, unreadIds);
        }
    }, [messages, conversation, currentUser, markMessagesRead]);

    const formatMessageTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateSeparator = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
    };

    const shouldShowDateSeparator = (msg, index) => {
        if (index === 0) return true;
        const prevDate = new Date(messages[index - 1].createdAt).toDateString();
        const currDate = new Date(msg.createdAt).toDateString();
        return prevDate !== currDate;
    };

    const isTyping = Object.keys(typingUsers).length > 0;

    const formatLastSeen = (dateStr) => {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMin = Math.floor((now - date) / 60000);

        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    if (!conversation) {
        return (
            <div className="chat-window chat-window--empty">
                <div className="empty-chat">
                    <div className="empty-chat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h2>Select a conversation</h2>
                    <p>Choose a chat from the sidebar or start a new one</p>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-window">
            {/* Chat Header */}
            <div className="chat-header">
                <button className="back-btn" onClick={onBackClick}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <div className="chat-header-avatar">
                    <div className="avatar-circle">
                        {otherParticipant?.firstName?.[0]?.toUpperCase() || '?'}
                    </div>
                    {isOtherOnline && <span className="online-dot"></span>}
                </div>
                <div className="chat-header-info">
                    <h3>{otherParticipant ? `${otherParticipant.firstName} ${otherParticipant.lastName}` : 'Unknown'}</h3>
                    <span className="chat-header-status">
                        {isTyping
                            ? 'typing...'
                            : isOtherOnline
                                ? 'Online'
                                : `Last seen ${formatLastSeen(otherParticipant?.lastSeen)}`
                        }
                    </span>
                </div>
            </div>

            {/* Messages Area */}
            <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
                {loadingMore && (
                    <div className="load-more-indicator">
                        <div className="loading-spinner loading-spinner--small"></div>
                        <span>Loading older messages...</span>
                    </div>
                )}

                {hasMore && !loadingMore && (
                    <div className="load-more-indicator">
                        <button className="load-more-btn" onClick={onLoadMore}>Load older messages</button>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const senderId = msg.sender?._id || msg.sender;
                    const isMine = senderId === currentUser?.id;

                    return (
                        <div key={msg._id || index}>
                            {shouldShowDateSeparator(msg, index) && (
                                <div className="date-separator">
                                    <span>{formatDateSeparator(msg.createdAt)}</span>
                                </div>
                            )}
                            <div className={`message ${isMine ? 'message--sent' : 'message--received'}`}>
                                <div className="message-bubble">
                                    <p className="message-content">{msg.content}</p>
                                    <div className="message-meta">
                                        <span className="message-time">{formatMessageTime(msg.createdAt)}</span>
                                        {isMine && (
                                            <span className="message-status">
                                                {msg.readBy && msg.readBy.length > 1 ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="read-icon">
                                                        <polyline points="2 12 7 17 12 12" />
                                                        <polyline points="9 12 14 17 22 7" />
                                                    </svg>
                                                ) : (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sent-icon">
                                                        <polyline points="5 12 10 17 20 7" />
                                                    </svg>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {isTyping && (
                    <div className="message message--received">
                        <div className="message-bubble typing-bubble">
                            <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <MessageInput conversationId={conversation._id} />
        </div>
    );
};

export default ChatWindow;
