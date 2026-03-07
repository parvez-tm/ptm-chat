import express from 'express';
import { register, login, logout, refreshToken, getProfile, updateProfile, changePassword } from './auth-controller.js';
import { token_middleware } from '../../middleware/auth-middleware.js';
import { loginLimiter } from '../../middleware/rate-limiter.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/logout', token_middleware, logout);
router.post('/refresh', refreshToken);
router.get('/profile', token_middleware, getProfile);
router.put('/profile', token_middleware, updateProfile);
router.put('/change-password', token_middleware, changePassword);

export default router;
