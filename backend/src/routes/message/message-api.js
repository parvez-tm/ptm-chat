import express from 'express';
import { sendMessage, getMessages, markAsRead } from './message-controller.js';
import { token_middleware } from '../../middleware/auth-middleware.js';
import { messageLimiter } from '../../middleware/rate-limiter.js';

const router = express.Router();

router.post('/', token_middleware, messageLimiter, sendMessage);
router.get('/:conversationId', token_middleware, getMessages);
router.put('/read/:conversationId', token_middleware, markAsRead);

export default router;
