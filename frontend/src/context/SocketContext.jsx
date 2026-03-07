import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const { token, isAuthenticated } = useAuth();
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        if (isAuthenticated && token) {
            // Create socket connection
            const newSocket = io('http://localhost:4400', {
                auth: { token },
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10,
                transports: ['websocket', 'polling']
            });

            newSocket.on('connect', () => {
                console.log('🟢 Socket connected:', newSocket.id);
                setConnected(true);
            });

            newSocket.on('disconnect', (reason) => {
                console.log('🔴 Socket disconnected:', reason);
                setConnected(false);
            });

            newSocket.on('onlineUsers', (users) => {
                setOnlineUsers(users);
            });

            newSocket.on('userOnline', ({ userId }) => {
                setOnlineUsers(prev => [...new Set([...prev, userId])]);
            });

            newSocket.on('userOffline', ({ userId }) => {
                setOnlineUsers(prev => prev.filter(id => id !== userId));
            });

            newSocket.on('connect_error', (err) => {
                console.error('Socket connection error:', err.message);
            });

            socketRef.current = newSocket;
            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
                socketRef.current = null;
                setSocket(null);
                setConnected(false);
            };
        }
    }, [isAuthenticated, token]);

    const joinConversation = useCallback((conversationId) => {
        if (socketRef.current) {
            socketRef.current.emit('joinConversation', conversationId);
        }
    }, []);

    const leaveConversation = useCallback((conversationId) => {
        if (socketRef.current) {
            socketRef.current.emit('leaveConversation', conversationId);
        }
    }, []);

    const sendMessage = useCallback((conversationId, content) => {
        if (socketRef.current) {
            socketRef.current.emit('sendMessage', { conversationId, content });
        }
    }, []);

    const emitTyping = useCallback((conversationId) => {
        if (socketRef.current) {
            socketRef.current.emit('typing', { conversationId });
        }
    }, []);

    const emitStopTyping = useCallback((conversationId) => {
        if (socketRef.current) {
            socketRef.current.emit('stopTyping', { conversationId });
        }
    }, []);

    const markMessagesRead = useCallback((conversationId, messageIds) => {
        if (socketRef.current) {
            socketRef.current.emit('messageRead', { conversationId, messageIds });
        }
    }, []);

    const value = {
        socket,
        connected,
        onlineUsers,
        joinConversation,
        leaveConversation,
        sendMessage,
        emitTyping,
        emitStopTyping,
        markMessagesRead
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

export default SocketContext;
