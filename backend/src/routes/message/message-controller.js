import Message from './message-model.js';
import Conversation from '../conversation/conversation-model.js';
import redisClient from '../../config/redis.js';

export const sendMessage = async (req, res) => {
    try {
        const { conversationId, content } = req.body;
        const senderId = req.user._id;

        if (!conversationId || !content) {
            return res.status(400).json({ message: 'Conversation ID and content are required' });
        }

        // Verify the conversation exists and user is a participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: senderId,
            isDeleted: false
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Create message
        const message = await Message.create({
            conversationId,
            sender: senderId,
            content: content.trim(),
            readBy: [senderId] // Sender has already "read" it
        });

        // Update conversation's lastMessage
        conversation.lastMessage = message._id;
        await conversation.save();

        // Cache in Redis (last 50 messages per conversation)
        const cacheKey = `chat:${conversationId}:messages`;
        const messageData = JSON.stringify({
            _id: message._id,
            conversationId,
            sender: senderId,
            content: message.content,
            readBy: message.readBy,
            createdAt: message.createdAt
        });

        await redisClient.lpush(cacheKey, messageData);
        await redisClient.ltrim(cacheKey, 0, 49); // Keep only last 50
        await redisClient.expire(cacheKey, 3600); // 1 hour TTL

        // Populate sender info for response
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'userName firstName lastName pic')
            .lean();

        return res.status(201).json({ data: populatedMessage, message: 'Message sent' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;

        // Verify the conversation exists and user is a participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId,
            isDeleted: false
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Try Redis cache for page 1
        if (page === 1) {
            try {
                const cachedMessages = await redisClient.lrange(`chat:${conversationId}:messages`, 0, limit - 1);
                if (cachedMessages && cachedMessages.length > 0) {
                    const parsed = cachedMessages.map(m => JSON.parse(m));
                    // Still need total count from DB
                    const totalMessages = await Message.countDocuments({ conversationId, isDeleted: false });
                    return res.status(200).json({
                        data: parsed,
                        pagination: {
                            currentPage: 1,
                            totalPages: Math.ceil(totalMessages / limit),
                            pageSize: limit,
                            totalDocs: totalMessages
                        },
                        cached: true
                    });
                }
            } catch (cacheErr) {
                // Fall through to DB query
                console.error('Cache read error:', cacheErr.message);
            }
        }

        const skip = (page - 1) * limit;

        const [messages, totalMessages] = await Promise.all([
            Message.find({ conversationId, isDeleted: false })
                .populate('sender', 'userName firstName lastName pic')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Message.countDocuments({ conversationId, isDeleted: false })
        ]);

        return res.status(200).json({
            data: messages,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalMessages / limit),
                pageSize: limit,
                totalDocs: totalMessages
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        // Mark all unread messages in this conversation as read by this user
        await Message.updateMany(
            {
                conversationId,
                sender: { $ne: userId },
                readBy: { $nin: [userId] },
                isDeleted: false
            },
            {
                $addToSet: { readBy: userId }
            }
        );

        return res.status(200).json({ message: 'Messages marked as read' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};
