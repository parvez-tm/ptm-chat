import jwt from 'jsonwebtoken';
import User from '../routes/user/user-model.js';
import Message from '../routes/message/message-model.js';
import Conversation from '../routes/conversation/conversation-model.js';
import redisClient from '../config/redis.js';

export const initializeSocket = (io) => {
    // Socket.IO authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }

            // Check if token is blacklisted
            const isBlacklisted = await redisClient.get(`bl:${token}`);
            if (isBlacklisted) {
                return next(new Error('Token has been invalidated'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password -refreshToken');
            if (!user) {
                return next(new Error('User not found'));
            }

            socket.userId = user._id.toString();
            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.userId;
        console.log(`🟢 User connected: ${userId} (socket: ${socket.id})`);

        // --- REDIS: Store session mapping & online presence ---
        await redisClient.hset('socket_sessions', userId, socket.id);
        await redisClient.sadd('online_users', userId);

        // Update DB
        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

        // Broadcast online status to all connected clients
        socket.broadcast.emit('userOnline', { userId });

        // Send the current online users list to the newly connected client
        const onlineUsers = await redisClient.smembers('online_users');
        socket.emit('onlineUsers', onlineUsers);

        // --- JOIN CONVERSATION ROOM ---
        socket.on('joinConversation', (conversationId) => {
            socket.join(`conversation:${conversationId}`);
            console.log(`📥 ${userId} joined conversation: ${conversationId}`);
        });

        // --- LEAVE CONVERSATION ROOM ---
        socket.on('leaveConversation', (conversationId) => {
            socket.leave(`conversation:${conversationId}`);
        });

        // --- SEND MESSAGE ---
        socket.on('sendMessage', async ({ conversationId, content }) => {
            try {
                if (!conversationId || !content || !content.trim()) return;

                // Verify user is participant
                const conversation = await Conversation.findOne({
                    _id: conversationId,
                    participants: userId,
                    isDeleted: false
                });

                if (!conversation) return;

                // Create message
                const message = await Message.create({
                    conversationId,
                    sender: userId,
                    content: content.trim(),
                    readBy: [userId]
                });

                // Update conversation's lastMessage
                conversation.lastMessage = message._id;
                await conversation.save();

                // Cache in Redis
                const cacheKey = `chat:${conversationId}:messages`;
                const messageData = JSON.stringify({
                    _id: message._id,
                    conversationId,
                    sender: userId,
                    content: message.content,
                    readBy: message.readBy,
                    createdAt: message.createdAt
                });
                await redisClient.lpush(cacheKey, messageData);
                await redisClient.ltrim(cacheKey, 0, 49);
                await redisClient.expire(cacheKey, 3600);

                // Populate sender for emit
                const populatedMessage = await Message.findById(message._id)
                    .populate('sender', 'userName firstName lastName pic')
                    .lean();

                // Emit to conversation room
                io.to(`conversation:${conversationId}`).emit('newMessage', populatedMessage);

                // Also emit to the other participant if not in the room (for sidebar update)
                const otherParticipantId = conversation.participants
                    .find(p => p.toString() !== userId)?.toString();

                if (otherParticipantId) {
                    const otherSocketId = await redisClient.hget('socket_sessions', otherParticipantId);
                    if (otherSocketId) {
                        io.to(otherSocketId).emit('conversationUpdated', {
                            conversationId,
                            lastMessage: populatedMessage
                        });
                    }
                }
            } catch (error) {
                console.error('Error sending message via socket:', error.message);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // --- TYPING INDICATOR ---
        socket.on('typing', ({ conversationId }) => {
            socket.to(`conversation:${conversationId}`).emit('userTyping', {
                userId,
                conversationId
            });
        });

        socket.on('stopTyping', ({ conversationId }) => {
            socket.to(`conversation:${conversationId}`).emit('userStopTyping', {
                userId,
                conversationId
            });
        });

        // --- READ RECEIPTS ---
        socket.on('messageRead', async ({ conversationId, messageIds }) => {
            try {
                if (!messageIds || !messageIds.length) return;

                await Message.updateMany(
                    {
                        _id: { $in: messageIds },
                        conversationId,
                        readBy: { $nin: [userId] }
                    },
                    { $addToSet: { readBy: userId } }
                );

                // Notify the sender
                socket.to(`conversation:${conversationId}`).emit('messagesRead', {
                    conversationId,
                    readBy: userId,
                    messageIds
                });
            } catch (error) {
                console.error('Error marking messages as read:', error.message);
            }
        });

        // --- DISCONNECT ---
        socket.on('disconnect', async () => {
            console.log(`🔴 User disconnected: ${userId}`);

            // Remove from Redis
            await redisClient.hdel('socket_sessions', userId);
            await redisClient.srem('online_users', userId);

            // Update DB
            await User.findByIdAndUpdate(userId, {
                isOnline: false,
                lastSeen: new Date()
            });

            // Broadcast offline status
            socket.broadcast.emit('userOffline', {
                userId,
                lastSeen: new Date()
            });
        });
    });
};
