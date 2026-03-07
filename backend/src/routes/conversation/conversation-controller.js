import Conversation from './conversation-model.js';
import User from '../user/user-model.js';
import Message from '../message/message-model.js';

export const createOrGetConversation = async (req, res) => {
    try {
        const { participantId } = req.body;
        const userId = req.user._id;

        if (!participantId) {
            return res.status(400).json({ message: 'Participant ID is required' });
        }

        if (participantId === userId.toString()) {
            return res.status(400).json({ message: 'Cannot create conversation with yourself' });
        }

        // Check if participant exists
        const participant = await User.findOne({ _id: participantId, isDeleted: false });
        if (!participant) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check for existing conversation between these two users
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, participantId] },
            isDeleted: false
        }).populate('participants', 'userName firstName lastName email pic isOnline lastSeen')
            .populate('lastMessage');

        if (conversation) {
            return res.status(200).json({ data: conversation, message: 'Conversation found' });
        }

        // Create new conversation
        conversation = await Conversation.create({
            participants: [userId, participantId]
        });

        // Populate the response
        conversation = await Conversation.findById(conversation._id)
            .populate('participants', 'userName firstName lastName email pic isOnline lastSeen');

        return res.status(201).json({ data: conversation, message: 'Conversation created' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const getUserConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId,
            isDeleted: false
        })
            .populate('participants', 'userName firstName lastName email pic isOnline lastSeen')
            .populate({
                path: 'lastMessage',
                select: 'content sender createdAt readBy'
            })
            .sort({ updatedAt: -1 })
            .lean();

        return res.status(200).json({ data: conversations });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};
