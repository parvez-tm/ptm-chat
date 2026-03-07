import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import UserList from '../components/UserList';
import api from '../utils/api';
import './ChatPage.css';

const ChatPage = () => {
    const { user, logout } = useAuth();
    const { socket, onlineUsers, joinConversation, leaveConversation } = useSocket();
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [showUserList, setShowUserList] = useState(false);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

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

    // Fetch messages for active conversation
    const fetchMessages = useCallback(async (conversationId) => {
        try {
            const { data } = await api.get(`/message/${conversationId}`);
            setMessages(data.data.reverse()); // Reverse to show oldest first
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    }, []);

    // Handle conversation selection
    const handleSelectConversation = useCallback((conversation) => {
        // Leave previous conversation room
        if (activeConversation) {
            leaveConversation(activeConversation._id);
        }

        setActiveConversation(conversation);
        joinConversation(conversation._id);
        fetchMessages(conversation._id);
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

    // Listen for new messages via socket
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (message) => {
            if (activeConversation && message.conversationId === activeConversation._id) {
                setMessages(prev => [...prev, message]);
            }
            // Update conversation list
            fetchConversations();
        };

        const handleConversationUpdated = () => {
            fetchConversations();
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('conversationUpdated', handleConversationUpdated);

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('conversationUpdated', handleConversationUpdated);
        };
    }, [socket, activeConversation, fetchConversations]);

    // Handle message sent (add to local state immediately)
    const handleMessageSent = (message) => {
        // Message will arrive via socket, but we can optimistically add it
        // The socket handler will deduplicate
    };

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
                onMessageSent={handleMessageSent}
                onBackClick={() => setMobileSidebarOpen(true)}
            />

            {showUserList && (
                <UserList
                    onSelect={handleStartConversation}
                    onClose={() => setShowUserList(false)}
                    currentUserId={user?.id}
                />
            )}
        </div>
    );
};

export default ChatPage;
