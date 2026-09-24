import { Router } from 'express'
import * as camp from '../controllers/camp.controller'
import * as participant from '../controllers/participant.controller'
import { authenticate, adminOnly, staffOnly, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/', camp.getCamps)
router.post('/', authorize('SUPER_ADMIN'), camp.createCamp)
router.get('/:id', camp.getCampById)
router.put('/:id', adminOnly, camp.updateCamp)
router.delete('/:id', authorize('SUPER_ADMIN'), camp.deleteCamp)
router.put('/:id/config', authorize('SUPER_ADMIN'), camp.updateCampConfig)
router.put('/:id/admin', authorize('SUPER_ADMIN'), camp.updateCampAdmin)
router.get('/:id/stats', staffOnly, camp.getCampStats)

// Participants imbriqués sous /camps/:campId/participants
router.get('/:campId/participants', staffOnly, participant.getParticipants)
router.post('/:campId/participants', staffOnly, participant.createParticipant)

// Paroisses d'un camp
router.get('/:campId/paroisses',                   staffOnly, camp.getCampParoisses)
router.post('/:campId/paroisses',                  staffOnly, camp.createCampParoisse)
router.put('/:campId/paroisses/:paroisseId',       staffOnly, camp.updateCampParoisse)
router.delete('/:campId/paroisses/:paroisseId',    adminOnly, camp.deleteCampParoisse)

export default router
