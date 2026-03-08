import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import UserList from '../components/UserList';
import ProfileModal from '../components/ProfileModal';
import api from '../utils/api';
import './ChatPage.css';

const ChatPage = () => {
    const { user, logout } = useAuth();
    const { socket, onlineUsers, joinConversation, leaveConversation } = useSocket();
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [showUserList, setShowUserList] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

    // Pagination state
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const activeConvRef = useRef(null);

    // Keep ref in sync for socket callbacks
    useEffect(() => {
        activeConvRef.current = activeConversation;
    }, [activeConversation]);

    // Fetch conversations
    const fetchConversations = useCallback(async () => {
        try {
            const { data } = await api.get('/conversation');
            setConversations(data.data);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoadingConversations(false);
        }
    }, []);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Fetch messages for active conversation (supports pagination)
    const fetchMessages = useCallback(async (conversationId, pageNum = 1) => {
        try {
            setLoadingMessages(true);
            const { data } = await api.get(`/message/${conversationId}?page=${pageNum}`);
            const fetched = data.data.reverse(); // oldest first

            if (pageNum === 1) {
                setMessages(fetched);
            } else {
                setMessages(prev => [...fetched, ...prev]);
            }

            const pagination = data.pagination;
            setHasMore(pagination ? pagination.currentPage < pagination.totalPages : false);
            setPage(pageNum);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    // Load older messages (called from ChatWindow on scroll-to-top)
    const loadOlderMessages = useCallback(() => {
        if (activeConversation && hasMore && !loadingMessages) {
            fetchMessages(activeConversation._id, page + 1);
        }
    }, [activeConversation, hasMore, loadingMessages, page, fetchMessages]);

    // Handle conversation selection
    const handleSelectConversation = useCallback((conversation) => {
        if (activeConversation) {
            leaveConversation(activeConversation._id);
        }

        setActiveConversation(conversation);
        setMessages([]);
        setPage(1);
        setHasMore(false);
        joinConversation(conversation._id);
        fetchMessages(conversation._id, 1);
        setMobileSidebarOpen(false);
    }, [activeConversation, joinConversation, leaveConversation, fetchMessages]);

    // Start new conversation
    const handleStartConversation = async (participantId) => {
        try {
            const { data } = await api.post('/conversation', { participantId });
            setShowUserList(false);
            await fetchConversations();
            handleSelectConversation(data.data);
        } catch (error) {
            console.error('Error creating conversation:', error);
        }
    };

    // Socket listeners for new messages, conversation updates, and read receipts
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (message) => {
            const currentConv = activeConvRef.current;
            if (currentConv && message.conversationId === currentConv._id) {
                setMessages(prev => {
                    // Deduplicate in case socket fires twice
                    if (prev.some(m => m._id === message._id)) return prev;
                    return [...prev, message];
                });
            }
            // Update conversation list (move to top, update lastMessage)
            fetchConversations();
        };

        const handleConversationUpdated = ({ conversationId, lastMessage }) => {
            setConversations(prev => {
                const exists = prev.some(conv => conv._id === conversationId);
                if (!exists) {
                    // Conversation not in list yet — refetch to pick it up
                    fetchConversations();
                    return prev;
                }
                return prev.map(conv =>
                    conv._id === conversationId
                        ? { ...conv, lastMessage, updatedAt: new Date().toISOString() }
                        : conv
                ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            });
        };

        const handleNewConversation = (conversation) => {
            setConversations(prev => {
                if (prev.some(c => c._id === conversation._id)) return prev;
                return [conversation, ...prev];
            });
        };

        const handleMessagesRead = ({ conversationId, readBy, messageIds }) => {
            const currentConv = activeConvRef.current;
            if (currentConv && conversationId === currentConv._id) {
                setMessages(prev =>
                    prev.map(msg => {
                        if (messageIds.includes(msg._id) && !msg.readBy?.includes(readBy)) {
                            return { ...msg, readBy: [...(msg.readBy || []), readBy] };
                        }
                        return msg;
                    })
                );
            }
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('conversationUpdated', handleConversationUpdated);
        socket.on('newConversation', handleNewConversation);
        socket.on('messagesRead', handleMessagesRead);

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('conversationUpdated', handleConversationUpdated);
            socket.off('newConversation', handleNewConversation);
            socket.off('messagesRead', handleMessagesRead);
        };
    }, [socket, fetchConversations]);

    const handleLogout = async () => {
        if (activeConversation) {
            leaveConversation(activeConversation._id);
        }
        await logout();
    };

    return (
        <div className="chat-page">
            <Sidebar
                conversations={conversations}
                activeConversation={activeConversation}
                onSelectConversation={handleSelectConversation}
                onNewChat={() => setShowUserList(true)}
                onLogout={handleLogout}
                onProfileClick={() => setShowProfile(true)}
                currentUser={user}
                onlineUsers={onlineUsers}
                loading={loadingConversations}
                isOpen={mobileSidebarOpen}
                onToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            />

            <ChatWindow
                conversation={activeConversation}
                messages={messages}
                currentUser={user}
                onlineUsers={onlineUsers}
                onBackClick={() => setMobileSidebarOpen(true)}
                hasMore={hasMore}
                loadingMore={loadingMessages}
                onLoadMore={loadOlderMessages}
            />

            {showUserList && (
                <UserList
                    onSelect={handleStartConversation}
                    onClose={() => setShowUserList(false)}
                    currentUserId={user?.id}
                />
            )}

            {showProfile && (
                <ProfileModal onClose={() => setShowProfile(false)} />
            )}
        </div>
    );
};

export default ChatPage;
