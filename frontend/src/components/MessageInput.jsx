import { useState, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import './MessageInput.css';

const MessageInput = ({ conversationId }) => {
    const [message, setMessage] = useState('');
    const { sendMessage, emitTyping, emitStopTyping } = useSocket();
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    const handleTyping = useCallback(() => {
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            emitTyping(conversationId);
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            emitStopTyping(conversationId);
        }, 2000);
    }, [conversationId, emitTyping, emitStopTyping]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = message.trim();
        if (!trimmed) return;

        sendMessage(conversationId, trimmed);
        setMessage('');

        // Stop typing indicator
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        isTypingRef.current = false;
        emitStopTyping(conversationId);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <form className="message-input-container" onSubmit={handleSubmit}>
            <div className="message-input-wrapper">
                <input
                    type="text"
                    className="message-input"
                    value={message}
                    onChange={(e) => {
                        setMessage(e.target.value);
                        handleTyping();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    autoComplete="off"
                    id="message-input"
                />
                <button
                    type="submit"
                    className={`send-btn ${message.trim() ? 'send-btn--active' : ''}`}
                    disabled={!message.trim()}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>
        </form>
    );
};

export default MessageInput;
