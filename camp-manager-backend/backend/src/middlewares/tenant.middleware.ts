import { Response, NextFunction } from 'express'
import prisma from '../config/prisma'
import { AuthRequest } from '../types'
import { authenticate } from './auth.middleware'
import { sendError } from '../utils/response'
import { RESOURCES } from '../config/ecoleResources'

// ─── Modules attribuables à un admin de camp ─────────────────
export const MODULES_CAMP = [
  'participants', 'medical', 'groupes', 'animateurs', 'planning', 'caisse',
  'documents', 'messages', 'statistiques', 'presence', 'visiteurs', 'dons',
  'rapport', 'enseignements', 'causeries',
] as const
export const MODULES_ECOLE = [
  'eleves', 'sante_ecole', 'groupes_ecole', 'enseignants', 'emploi_temps', 'frais',
  'documents_eleves', 'messages_ecole', 'statistiques_ecole', 'sorties_eleves',
  'visiteurs_ecole', 'dons_ecole', 'rapport_ecole', 'lecons', 'causeries_ecole',
  'classes', 'evaluations', 'programme_ecole', 'presences_eleves',
] as const
export const MODULES = [...MODULES_CAMP, ...MODULES_ECOLE] as const
export type Module = typeof MODULES[number]

// Champs de la fiche élève que le super admin peut activer par école
export const CHAMPS_ELEVE = [
  'sexe', 'dateNaissance', 'lieuNaissance', 'parent', 'telephoneParent',
  'adresse', 'infosMedicales', 'classe', 'groupes', 'notes',
] as const

// Modules autorisés selon le type d'espace : l'école a ses propres modules
export const modulesFor = (type: 'CAMP' | 'ECOLE'): readonly string[] =>
  type === 'ECOLE' ? MODULES_ECOLE : MODULES_CAMP

// Segment d'URL → module requis
const MODULE_BY_SEGMENT: Record<string, Module> = {
  participants: 'participants',
  groupes: 'groupes',
  animateurs: 'animateurs',
  activites: 'planning',
  paiements: 'caisse',
  depenses: 'caisse',
  documents: 'documents',
  messages: 'messages',
  'fiches-presence': 'presence',
  visiteurs: 'visiteurs',
  dons: 'dons',
  enseignements: 'enseignements',
  causeries: 'causeries',
  eleves: 'eleves',
  classes: 'classes',
  'groupes-ecole': 'groupes_ecole',
  competences: 'evaluations',
  evaluations: 'evaluations',
  programmes: 'programme_ecole',
  'presences-eleves': 'presences_eleves',
}

// Ressources du registre école : segment d'URL → module, et propriétaire de la ligne
for (const r of RESOURCES) MODULE_BY_SEGMENT[r.path] = r.module as Module
MODULE_BY_SEGMENT.rapports = 'rapport_ecole'
MODULE_BY_SEGMENT['statistiques-ecole'] = 'statistiques_ecole'

const campOf = (row: { campId: string | null } | null | undefined) => row?.campId
const viaParticipant = (row: { campId: string | null; participant?: { campId: string } | null } | null) =>
  row ? (row.campId ?? row.participant?.campId ?? null) : undefined

// Segment d'URL → camp propriétaire de la ressource (undefined = ressource inexistante)
const CAMP_OF: Record<string, (id: string) => Promise<string | null | undefined>> = {
  camps:            async id => id,
  participants:     async id => campOf(await prisma.participant.findUnique({ where: { id }, select: { campId: true } })),
  groupes:          async id => campOf(await prisma.groupe.findUnique({ where: { id }, select: { campId: true } })),
  animateurs:       async id => campOf(await prisma.animateur.findUnique({ where: { id }, select: { campId: true } })),
  activites:        async id => campOf(await prisma.activite.findUnique({ where: { id }, select: { campId: true } })),
  depenses:         async id => campOf(await prisma.depense.findUnique({ where: { id }, select: { campId: true } })),
  messages:         async id => campOf(await prisma.message.findUnique({ where: { id }, select: { campId: true } })),
  'fiches-presence': async id => campOf(await prisma.fichePresence.findUnique({ where: { id }, select: { campId: true } })),
  visiteurs:        async id => campOf(await prisma.visiteur.findUnique({ where: { id }, select: { campId: true } })),
  dons:             async id => campOf(await prisma.don.findUnique({ where: { id }, select: { campId: true } })),
  enseignements:    async id => campOf(await prisma.enseignement.findUnique({ where: { id }, select: { campId: true } })),
  causeries:        async id => campOf(await prisma.causerieGroupe.findUnique({ where: { id }, select: { campId: true } })),
  eleves:           async id => campOf(await prisma.eleve.findUnique({ where: { id }, select: { campId: true } })),
  classes:          async id => campOf(await prisma.classe.findUnique({ where: { id }, select: { campId: true } })),
  'groupes-ecole':  async id => campOf(await prisma.groupeEcole.findUnique({ where: { id }, select: { campId: true } })),
  competences:      async id => campOf(await prisma.competence.findUnique({ where: { id }, select: { campId: true } })),
  programmes:       async id => campOf(await prisma.programmeEcole.findUnique({ where: { id }, select: { campId: true } })),
  paroisses:        async id => campOf(await prisma.campParoisse.findUnique({ where: { id }, select: { campId: true } })),
  paiements:        async id => viaParticipant(await prisma.paiement.findUnique({ where: { id }, select: { campId: true, participant: { select: { campId: true } } } })),
  documents:        async id => (await prisma.document.findUnique({ where: { id }, select: { participant: { select: { campId: true } } } }))?.participant.campId,
  'articles-sac':   async id => (await prisma.articleSac.findUnique({ where: { id }, select: { participant: { select: { campId: true } } } }))?.participant.campId,
}

// Champs du body/query qui référencent une ressource d'un autre camp
const BODY_REFS: Record<string, string> = {
  participantId: 'participants',
  groupeId: 'groupes',
  animateurId: 'animateurs',
  activiteId: 'activites',
  eleveId: 'eleves',
  classeId: 'classes',
  enseignantId: 'enseignants',
  competenceId: 'competences',
}

for (const r of RESOURCES) {
  CAMP_OF[r.path] = async id => {
    const delegate = (prisma as any)[r.model]
    if (r.scope === 'camp') return (await delegate.findUnique({ where: { id }, select: { campId: true } }))?.campId
    return (await delegate.findUnique({ where: { id }, select: { eleve: { select: { campId: true } } } }))?.eleve.campId
  }
}

const ID_RE = /^[0-9a-zA-Z-]{8,64}$/

const guard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payload = req.user!
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { actif: true, role: true, campId: true, permissions: true },
    })
    if (!user || !user.actif) return sendError(res, 'Compte désactivé ou introuvable', 401)

    // Le rôle est relu en base : un changement de rôle/permissions est immédiat
    payload.role = user.role
    if (user.role === 'SUPER_ADMIN') return next()

    if (!user.campId) return sendError(res, 'Aucun camp n\'est associé à ce compte', 403)
    const campId = user.campId
    const deny = () => sendError(res, 'Accès refusé — ressource d\'un autre camp', 403)

    // Réservé au super admin : gestion des camps et de leurs administrateurs
    const segments = req.path.split('/').filter(Boolean)
    if (segments[0] === 'camps' && (req.method === 'POST' && segments.length === 1
        || req.method === 'DELETE' && segments.length === 2
        || segments[2] === 'admin' || segments[2] === 'config')) {
      return sendError(res, 'Accès refusé — réservé au super administrateur', 403)
    }

    // Permission de module (première ressource reconnue dans l'URL)
    const seg = segments.find(s => MODULE_BY_SEGMENT[s])
    if (seg && !user.permissions.includes(MODULE_BY_SEGMENT[seg])) {
      return sendError(res, `Accès refusé — module « ${MODULE_BY_SEGMENT[seg]} » non autorisé`, 403)
    }

    // Toute ressource identifiée dans l'URL doit appartenir au camp de l'utilisateur
    for (let i = 0; i < segments.length - 1; i++) {
      const resolver = CAMP_OF[segments[i]]
      const id = segments[i + 1]
      if (!resolver || !ID_RE.test(id)) continue
      const owner = await resolver(id)
      if (owner !== undefined && owner !== campId) return deny()
    }

    // Listes : le filtre campId est imposé
    const qCamp = req.query.campId
    if (qCamp !== undefined && qCamp !== campId) return deny()
    if (req.method === 'GET') req.query.campId = campId

    // Corps : campId et références vers d'autres ressources
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    if (body.campId !== undefined && body.campId !== campId) return deny()
    const isEcolePath = segments[0] === 'ecole'
    for (const [field, resource] of Object.entries(isEcolePath ? { ...BODY_REFS, groupeId: 'groupes-ecole' } : BODY_REFS)) {
      const ref = body[field]
      if (typeof ref !== 'string' || !ref) continue
      const owner = await CAMP_OF[resource](ref)
      if (owner !== undefined && owner !== campId) return deny()
    }
    for (const [field, resource] of [['groupeIds', 'groupes'], ['groupeEcoleIds', 'groupes-ecole']] as const) {
      for (const gid of Array.isArray(body[field]) ? body[field] : []) {
        const owner = typeof gid === 'string' ? await CAMP_OF[resource](gid) : undefined
        if (owner !== undefined && owner !== campId) return deny()
      }
    }

    next()
  } catch (err) {
    next(err)
  }
}

// À monter sur /api : authentifie puis applique isolation par camp + permissions
export const tenantGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/auth') || req.path === '/health') return next()
  authenticate(req, res, (err?: unknown) => (err ? next(err) : guard(req, res, next)))
}
