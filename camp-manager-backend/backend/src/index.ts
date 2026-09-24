import 'dotenv/config'
import express from 'express'
import { initAdmin } from './scripts/initAdmin'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'

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

// FRONTEND_URL accepte une liste séparée par des virgules (prod + previews).
// Les sous-domaines *.vercel.app sont aussi acceptés : les URLs de preview
// Vercel changent à chaque déploiement et ne peuvent pas être toutes listées
// à l'avance. L'auth se fait par Bearer token (pas de cookies), donc un
// site tiers hébergé sur vercel.app ne peut pas accéder aux données d'un
// utilisateur sans déjà avoir son token.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim()).filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    try {
      if (new URL(origin).hostname.endsWith('.vercel.app')) return callback(null, true)
    } catch { /* origin invalide → refusé ci-dessous */ }
    callback(new Error('Origin non autorisée'))
  },
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

// ─── Frontend statique (production Railway : build copié dans public/) ─
// Absent sur Vercel, où le frontend est déployé comme projet séparé.
const publicDir = path.join(__dirname, '..', 'public')
const hasPublicBuild = fs.existsSync(path.join(publicDir, 'index.html'))
if (process.env.NODE_ENV === 'production' && hasPublicBuild) {
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

// ─── SPA fallback (production Railway uniquement) ─────────────
if (process.env.NODE_ENV === 'production' && hasPublicBuild) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

// ─── Démarrage ───────────────────────────────────────────────
// Idempotent : ne crée l'admin que si la base est vide.
initAdmin()

// Sur Vercel, la fonction serverless importe `app` sans jamais l'écouter
// sur un port — c'est Vercel qui reçoit la requête HTTP et l'y transmet.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🏕️  Camp Manager API`)
    console.log(`   Environnement : ${process.env.NODE_ENV || 'development'}`)
    console.log(`   URL           : http://localhost:${PORT}`)
    console.log(`   Health        : http://localhost:${PORT}/health\n`)
  })
}

export default app
