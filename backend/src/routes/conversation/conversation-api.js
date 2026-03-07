import express from 'express';
import { createOrGetConversation, getUserConversations } from './conversation-controller.js';
import { token_middleware } from '../../middleware/auth-middleware.js';

const router = express.Router();

router.post('/', token_middleware, createOrGetConversation);
router.get('/', token_middleware, getUserConversations);

export default router;
