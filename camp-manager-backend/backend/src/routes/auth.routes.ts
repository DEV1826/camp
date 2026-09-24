import { Router } from 'express'
import * as auth from '../controllers/auth.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.post('/register', authenticate, authorize('SUPER_ADMIN'), auth.register)
router.post('/login', auth.login)
router.post('/refresh', auth.refresh)
router.get('/me', authenticate, auth.me)
router.put('/password', authenticate, auth.changePassword)

export default router
