import { Response, NextFunction } from 'express'
import prisma from '../config/prisma'
import { sendSuccess, sendCreated } from '../utils/response'
import { AppError } from '../middlewares/error.middleware'
import { AuthRequest } from '../types'
import bcrypt from 'bcryptjs'
import { modulesFor, CHAMPS_ELEVE } from '../middlewares/tenant.middleware'

const ADMIN_SELECT = { id: true, nom: true, prenom: true, email: true, actif: true, permissions: true } as const

const parsePermissions = (value: unknown, type: 'CAMP' | 'ECOLE'): string[] => {
  if (!Array.isArray(value)) throw new AppError('permissions doit être une liste', 400)
  const invalid = value.filter(p => !modulesFor(type).includes(p))
  if (invalid.length) throw new AppError(`Permissions inconnues : ${invalid.join(', ')}`, 400)
  return Array.from(new Set(value as string[]))
}

const parseChamps = (value: unknown): string[] => {
  if (!Array.isArray(value)) throw new AppError('champsEleve doit être une liste', 400)
  const invalid = value.filter(c => !(CHAMPS_ELEVE as readonly string[]).includes(c))
  if (invalid.length) throw new AppError(`Champs inconnus : ${invalid.join(', ')}`, 400)
  return Array.from(new Set(value as string[]))
}

// ─── GET /camps ──────────────────────────────────────────────
export const getCamps = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, perPage = 10, search, statut } = req.query

    const skip = (Number(page) - 1) * Number(perPage)
    const where: any = {}

    // Un admin de camp ne voit que son propre camp
    if (req.user!.role !== 'SUPER_ADMIN') {
      const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { campId: true } })
      where.id = me?.campId ?? '__none__'
    }

    if (search) {
      where.OR = [
        { nom: { contains: String(search), mode: 'insensitive' } },
        { lieu: { contains: String(search), mode: 'insensitive' } },
      ]
    }
    if (statut) where.statut = statut

    const [camps, total] = await Promise.all([
      prisma.camp.findMany({
        where,
        skip,
        take: Number(perPage),
        orderBy: { dateDebut: 'desc' },
        include: {
          _count: { select: { participants: true, animateurs: true, activites: true } },
          users: { where: { role: 'ADMIN' }, select: ADMIN_SELECT },
        },
      }),
      prisma.camp.count({ where }),
    ])

    sendSuccess(res, camps, 'Camps récupérés', 200, {
      total,
      page: Number(page),
      perPage: Number(perPage),
      totalPages: Math.ceil(total / Number(perPage)),
    })
  } catch (err) {
    next(err)
  }
}

// ─── GET /camps/:id ──────────────────────────────────────────
export const getCampById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const camp = await prisma.camp.findUnique({
      where: { id: req.params.id },
      include: {
        animateurs: true,
        groupes: { include: { _count: { select: { participants: true } } } },
        _count: { select: { participants: true, activites: true } },
      },
    })
    if (!camp) throw new AppError('Camp introuvable', 404)

    sendSuccess(res, camp)
  } catch (err) {
    next(err)
  }
}

// ─── POST /camps ─────────────────────────────────────────────
export const createCamp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { nom, description, lieu, adresse, dateDebut, dateFin, capaciteMax, prixBase, admin } = req.body
    const type: 'CAMP' | 'ECOLE' = req.body.type === 'ECOLE' ? 'ECOLE' : 'CAMP'

    if (new Date(dateDebut) >= new Date(dateFin)) {
      throw new AppError('La date de début doit être avant la date de fin', 400)
    }
    if (!admin || !admin.nom || !admin.prenom || !admin.email || typeof admin.motDePasse !== 'string' || admin.motDePasse.length < 8) {
      throw new AppError('Un administrateur (nom, prénom, email, mot de passe de 8 caractères min.) est requis', 400)
    }
    const permissions = parsePermissions(admin.permissions ?? [], type)
    if (await prisma.user.findUnique({ where: { email: admin.email } })) {
      throw new AppError('Cet email est déjà utilisé', 409)
    }
    const hash = await bcrypt.hash(admin.motDePasse, 12)

    // Camp + administrateur créés ensemble
    const camp = await prisma.camp.create({
      data: {
        nom, description, lieu, adresse, type,
        ...(type === 'ECOLE' && req.body.champsEleve !== undefined && { champsEleve: parseChamps(req.body.champsEleve) }),
        dateDebut: new Date(dateDebut), dateFin: new Date(dateFin),
        capaciteMax: Number(capaciteMax), prixBase: prixBase || 0,
        users: {
          create: {
            nom: admin.nom, prenom: admin.prenom, email: admin.email,
            motDePasseHash: hash, role: 'ADMIN', permissions,
          },
        },
      },
      include: { users: { select: ADMIN_SELECT } },
    })

    sendCreated(res, camp, 'Camp et administrateur créés avec succès')
  } catch (err) {
    next(err)
  }
}

// ─── PUT /camps/:id ──────────────────────────────────────────
export const updateCamp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const camp = await prisma.camp.findUnique({ where: { id: req.params.id } })
    if (!camp) throw new AppError('Camp introuvable', 404)

    // Le type d'espace et l'identifiant ne sont pas modifiables
    const { id: _id, type: _type, users: _users, champsEleve: _champs, ...fields } = req.body
    const updated = await prisma.camp.update({
      where: { id: req.params.id },
      data: {
        ...fields,
        dateDebut: req.body.dateDebut ? new Date(req.body.dateDebut) : undefined,
        dateFin: req.body.dateFin ? new Date(req.body.dateFin) : undefined,
      },
    })

    sendSuccess(res, updated, 'Camp mis à jour')
  } catch (err) {
    next(err)
  }
}

// ─── PUT /camps/:id/admin ────────────────────────────────────
// Super admin : modifie permissions / statut / mot de passe de l'admin du camp
export const updateCampAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const admin = await prisma.user.findFirst({ where: { campId: req.params.id, role: 'ADMIN' } })
    if (!admin) throw new AppError('Administrateur du camp introuvable', 404)

    const { permissions, actif, motDePasse } = req.body
    const data: Record<string, unknown> = {}
    if (permissions !== undefined) {
      const camp = await prisma.camp.findUnique({ where: { id: req.params.id }, select: { type: true } })
      data.permissions = parsePermissions(permissions, camp?.type ?? 'CAMP')
    }
    if (actif !== undefined) data.actif = Boolean(actif)
    if (motDePasse !== undefined) {
      if (typeof motDePasse !== 'string' || motDePasse.length < 8) throw new AppError('Mot de passe : 8 caractères min.', 400)
      data.motDePasseHash = await bcrypt.hash(motDePasse, 12)
    }

    const updated = await prisma.user.update({ where: { id: admin.id }, data, select: ADMIN_SELECT })
    sendSuccess(res, updated, 'Administrateur mis à jour')
  } catch (err) { next(err) }
}

// ─── PUT /camps/:id/config ───────────────────────────────────
// Super admin : choisit les champs de la fiche élève d'une école
export const updateCampConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const camp = await prisma.camp.findUnique({ where: { id: req.params.id }, select: { type: true } })
    if (!camp) throw new AppError('Espace introuvable', 404)
    if (camp.type !== 'ECOLE') throw new AppError('Configuration réservée aux écoles', 400)
    const updated = await prisma.camp.update({
      where: { id: req.params.id },
      data: { champsEleve: parseChamps(req.body.champsEleve) },
      select: { id: true, champsEleve: true },
    })
    sendSuccess(res, updated, 'Champs mis à jour')
  } catch (err) { next(err) }
}

// ─── DELETE /camps/:id ───────────────────────────────────────
export const deleteCamp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const camp = await prisma.camp.findUnique({ where: { id: req.params.id } })
    if (!camp) throw new AppError('Camp introuvable', 404)

    await prisma.camp.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Camp supprimé')
  } catch (err) {
    next(err)
  }
}

// ─── GET /camps/:id/stats ────────────────────────────────────
export const getCampStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = req.params.id

    const camp = await prisma.camp.findUnique({ where: { id: campId } })
    if (!camp) throw new AppError('Camp introuvable', 404)

    const [participants, paiements, activites, documents] = await Promise.all([
      prisma.participant.groupBy({ by: ['statutInscription'], where: { campId }, _count: true }),
      prisma.paiement.aggregate({ where: { participant: { campId } }, _sum: { montant: true, montantTotal: true }, _count: true }),
      prisma.activite.count({ where: { campId } }),
      prisma.document.groupBy({ by: ['statut'], where: { participant: { campId } }, _count: true }),
    ])

    const totalParticipants = participants.reduce((acc, p) => acc + p._count, 0)
    const confirmes = participants.find(p => p.statutInscription === 'CONFIRME')?._count || 0
    const tauxOccupation = camp.capaciteMax > 0 ? Math.round((totalParticipants / camp.capaciteMax) * 100) : 0

    sendSuccess(res, {
      camp: { id: campId, nom: camp.nom, capaciteMax: camp.capaciteMax },
      participants: { total: totalParticipants, confirmes, tauxOccupation, parStatut: participants },
      finance: {
        totalEncaisse: paiements._sum.montant || 0,
        totalAttendu: paiements._sum.montantTotal || 0,
        nombrePaiements: paiements._count,
      },
      activites,
      documents: { parStatut: documents },
    })
  } catch (err) {
    next(err)
  }
}

// ─── GET /camps/:campId/paroisses ─────────────────────────────
export const getCampParoisses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const paroisses = await prisma.campParoisse.findMany({
      where: { campId: req.params.campId },
      orderBy: { nom: 'asc' },
    })
    sendSuccess(res, paroisses)
  } catch (err) { next(err) }
}

// ─── POST /camps/:campId/paroisses ────────────────────────────
export const createCampParoisse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { nom, responsable, telephone } = req.body
    if (!nom) throw new AppError('Nom de paroisse requis', 400)
    const p = await prisma.campParoisse.create({
      data: { campId: req.params.campId, nom, responsable, telephone },
    })
    sendCreated(res, p, 'Paroisse ajoutée')
  } catch (err) { next(err) }
}

// ─── PUT /camps/:campId/paroisses/:paroisseId ────────────────
export const updateCampParoisse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { nom, responsable, telephone, prixParticipant } = req.body
    const p = await prisma.campParoisse.update({
      where: { id: req.params.paroisseId },
      data: {
        ...(nom !== undefined && { nom }),
        ...(responsable !== undefined && { responsable }),
        ...(telephone !== undefined && { telephone }),
        ...(prixParticipant !== undefined && { prixParticipant: prixParticipant === '' || prixParticipant === null ? null : Number(prixParticipant) }),
      },
    })
    sendSuccess(res, p, 'Paroisse mise à jour')
  } catch (err) { next(err) }
}

// ─── DELETE /camps/:campId/paroisses/:paroisseId ──────────────
export const deleteCampParoisse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.campParoisse.delete({ where: { id: req.params.paroisseId } })
    sendSuccess(res, null, 'Paroisse supprimée')
  } catch (err) { next(err) }
}
