import express from 'express'
import { addPermission, deletePermission, getPermission, updatePermission } from './permission-controller.js';
import { token_middleware } from '../../middleware/auth-middleware.js';
import { admin_middleware } from '../../middleware/admin-middleware.js';
import { id_checker_middleware } from '../../middleware/id-checker-middleware.js';

const routes = express.Router();

routes.post('/addPermission',token_middleware, addPermission)
routes.get('/getPermission',token_middleware,admin_middleware, getPermission)
routes.put('/updatePermission/:id',token_middleware, id_checker_middleware, updatePermission)
routes.delete('/deletePermission/:id',token_middleware, id_checker_middleware, deletePermission)

export default routes