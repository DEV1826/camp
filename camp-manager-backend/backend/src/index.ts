import 'dotenv/config'
import express from 'express'
import { initAdmin } from './scripts/initAdmin'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import path from 'path'

import authRoutes from './routes/auth.routes'
import campRoutes from './routes/camp.routes'
import participantRoutes from './routes/participant.routes'
import activiteRoutes from './routes/activite.routes'
import paiementRoutes from './routes/paiement.routes'
import documentRoutes from './routes/document.routes'
import messageRoutes from './routes/message.routes'
import depenseRoutes from './routes/depense.routes'
import { tenantGuard } from './middlewares/tenant.middleware'
import { errorHandler, notFound } from './middlewares/error.middleware'


import groupeRoutes from './routes/groupe.routes'
import animateurRoutes from './routes/animateur.routes'
import fichePresenceRoutes from './routes/fichePresence.routes'
import visiteurRoutes from './routes/visiteur.routes'
import donRoutes from './routes/don.routes'
import articleSacRoutes from './routes/articleSac.routes'
import enseignementRoutes from './routes/enseignement.routes'
import ecoleRoutes from './routes/ecole.routes'
import ecoleModulesRoutes from './routes/ecoleModules.routes'
import causerieRoutes from './routes/causerie.routes'

const app = express()
const PORT = process.env.PORT || 3001

app.set('trust proxy', 1)

// ─── Sécurité ────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))

// ─── Rate limiting ───────────────────────────────────────────
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: 'Trop de tentatives, réessayez dans 15 minutes' },
}))

app.use(rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,                 // 300 req/min par IP — suffisant pour usage interne
  message: { success: false, message: 'Trop de requêtes, réessayez dans une minute' },
}))

// ─── Parsing & utilitaires ───────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(compression())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ─── Fichiers uploadés ───────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// ─── Frontend statique (production) — avant les routes API ───
const publicDir = path.join(__dirname, '..', 'public')
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(publicDir))
}

// ─── Health check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV })
})

// ─── Routes API ──────────────────────────────────────────────
app.use('/api', tenantGuard) // isolation par camp + permissions par module
app.use('/api/auth',         authRoutes)
app.use('/api/camps',        campRoutes)
app.use('/api/participants', participantRoutes)
app.use('/api/activites',    activiteRoutes)
app.use('/api/paiements',    paiementRoutes)
app.use('/api/depenses',     depenseRoutes)
app.use('/api/documents',    documentRoutes)
app.use('/api/messages',     messageRoutes)
app.use('/api',                 groupeRoutes)
app.use('/api/animateurs',      animateurRoutes)
app.use('/api/fiches-presence', fichePresenceRoutes)
app.use('/api/visiteurs',       visiteurRoutes)
app.use('/api/dons',            donRoutes)
app.use('/api/participants/:participantId/articles-sac', articleSacRoutes)
app.use('/api/camps/:campId/enseignements', enseignementRoutes)
app.use('/api/enseignements', enseignementRoutes)
app.use('/api/camps/:campId/causeries', causerieRoutes)

app.use('/api/ecole', ecoleModulesRoutes)
app.use('/api', ecoleRoutes)

// ─── 404 API ─────────────────────────────────────────────────
app.use('/api', notFound)
app.use(errorHandler)

// ─── SPA fallback (production) ───────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

// ─── Démarrage ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏕️  Camp Manager API`)
  console.log(`   Environnement : ${process.env.NODE_ENV || 'development'}`)
  console.log(`   URL           : http://localhost:${PORT}`)
  console.log(`   Health        : http://localhost:${PORT}/health\n`)
  initAdmin()
})

export default app
