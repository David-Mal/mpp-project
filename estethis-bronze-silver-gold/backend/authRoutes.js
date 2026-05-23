import { Router } from 'express';
import { loadUser, requireAuth, requireAdmin } from './authMiddleware.js';
import {
  register, login, logout, me, listUsers, deleteUser,
} from './authController.js';

const router = Router();

router.post('/register',       register);
router.post('/login',          login);
router.post('/logout',         loadUser, logout);
router.get ('/me',             loadUser, requireAuth,  me);
router.get ('/users',          loadUser, requireAdmin, listUsers);
router.delete('/users/:id',    loadUser, requireAdmin, deleteUser);

export default router;
