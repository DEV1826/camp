import { Router } from 'express'
import * as e from '../controllers/ecole.controller'
import { authenticate, staffOnly, adminOnly } from '../middlewares/auth.middleware'

// Module École maternelle — l'isolation par espace et les permissions
// sont appliquées en amont par tenantGuard
const router = Router()

router.use(authenticate)

router.get('/eleves/stats', staffOnly, e.getElevesStats)
router.get('/eleves',       staffOnly, e.getEleves)
router.post('/eleves',      staffOnly, e.createEleve)
router.put('/eleves/:id',   staffOnly, e.updateEleve)
router.delete('/eleves/:id', adminOnly, e.deleteEleve)

router.get('/classes',        staffOnly, e.getClasses)
router.post('/classes',       adminOnly, e.createClasse)
router.put('/classes/:id',    adminOnly, e.updateClasse)
router.delete('/classes/:id', adminOnly, e.deleteClasse)

router.get('/groupes-ecole',        staffOnly, e.getGroupesEcole)
router.post('/groupes-ecole',       adminOnly, e.createGroupeEcole)
router.put('/groupes-ecole/:id',    adminOnly, e.updateGroupeEcole)
router.delete('/groupes-ecole/:id', adminOnly, e.deleteGroupeEcole)

router.get('/competences',        staffOnly, e.getCompetences)
router.post('/competences',       adminOnly, e.createCompetence)
router.put('/competences/:id',    adminOnly, e.updateCompetence)
router.delete('/competences/:id', adminOnly, e.deleteCompetence)

router.get('/evaluations', staffOnly, e.getEvaluations)
router.put('/evaluations', staffOnly, e.setEvaluation)

router.get('/programmes',        staffOnly, e.getProgrammes)
router.post('/programmes',       staffOnly, e.createProgramme)
router.put('/programmes/:id',    staffOnly, e.updateProgramme)
router.delete('/programmes/:id', staffOnly, e.deleteProgramme)

router.get('/presences-eleves', staffOnly, e.getPresences)
router.put('/presences-eleves', staffOnly, e.savePresences)

export default router
