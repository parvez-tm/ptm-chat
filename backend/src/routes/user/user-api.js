import express from 'express';
import { addUser, getAllUsers, deleteUser, login, updateUser, getUserById } from './user-controller.js';
import { profileImage } from '../../services/multer-service.js';
import { token_middleware } from '../../middleware/auth-middleware.js';
import { id_checker_middleware } from '../../middleware/id-checker-middleware.js';

const router = express.Router();

router.post('/login', login);
router.get('/getAllUsers', token_middleware, getAllUsers);
router.get('/getUserById/:id', token_middleware,id_checker_middleware, getUserById);
router.post('/addUser', profileImage.single('profileImage'), addUser);
router.put('/updateUser/:id',id_checker_middleware,profileImage.single('profileImage'), updateUser);
router.delete('/deleteUser/:id', id_checker_middleware, deleteUser);


export default router;