import { Router } from 'express'
import { authenticate, staffOnly, adminOnly } from '../middlewares/auth.middleware'
import { RESOURCES } from '../config/ecoleResources'
import { makeCrud, getRapport, saveRapport, getStatistiques } from '../controllers/ecoleCrud.controller'

// Modules « école » : /api/ecole/<ressource>
// L'isolation par espace et les autorisations sont appliquées en amont par tenantGuard
const router = Router()
router.use(authenticate)

for (const res of RESOURCES) {
  const crud = makeCrud(res)
  const methods = res.methods ?? ['GET', 'POST', 'PUT', 'DELETE']
  const base = `/${res.path}`
  if (methods.includes('GET'))    router.get(base, staffOnly, crud.list)
  if (methods.includes('POST'))   router.post(base, staffOnly, crud.create)
  if (methods.includes('PUT'))    router.put(`${base}/:id`, staffOnly, crud.update)
  if (methods.includes('DELETE')) router.delete(`${base}/:id`, res.adminDelete ? adminOnly : staffOnly, crud.remove)
}

router.get('/rapports', staffOnly, getRapport)
router.put('/rapports', staffOnly, saveRapport)
router.get('/statistiques-ecole', staffOnly, getStatistiques)

export default router
