import { Response, NextFunction } from 'express'
import prisma from '../config/prisma'
import { sendSuccess, sendCreated } from '../utils/response'
import { AppError } from '../middlewares/error.middleware'
import { AuthRequest } from '../types'
import { Resource, Field } from '../config/ecoleResources'

// Prisma est typé par modèle : le CRUD générique passe par un accès dynamique
const delegate = (model: string) => (prisma as any)[model]

const getCampId = (req: AuthRequest): string => {
  const campId = String(req.query.campId ?? req.body?.campId ?? '')
  if (!campId) throw new AppError('campId requis', 400)
  return campId
}

// Colonnes NOT NULL avec valeur par défaut : un champ vide est simplement omis
const DEFAULTED = new Set(['statut', 'methode', 'couleur', 'datePaiement', 'dateDepense'])

// Convertit et valide une valeur du corps selon le type du champ
const coerce = (f: Field, value: unknown): unknown => {
  const empty = value === undefined || value === null || value === ''
  if (empty) {
    if (f.required) throw new AppError(`Champ requis : ${f.name}`, 400)
    return DEFAULTED.has(f.name) ? undefined : null
  }
  switch (f.kind) {
    case 'date':
    case 'datetime': {
      const dte = new Date(String(value))
      if (isNaN(dte.getTime())) throw new AppError(`Date invalide : ${f.name}`, 400)
      return dte
    }
    case 'number': {
      const num = Number(value)
      if (!isFinite(num) || num < 0) throw new AppError(`Nombre invalide : ${f.name}`, 400)
      return num
    }
    default:
      return String(value)
  }
}

// Une référence (élève, classe…) doit appartenir au même espace
const checkRef = async (f: Field, id: unknown, campId: string) => {
  if (!id || !f.ref) return
  const found = await delegate(f.ref).findFirst({ where: { id: String(id), campId }, select: { id: true } })
  if (!found) throw new AppError(`${f.name} introuvable dans cet espace`, 404)
}

const buildData = async (res: Resource, body: Record<string, unknown>, campId: string, partial: boolean) => {
  const data: Record<string, unknown> = {}
  for (const f of res.fields) {
    if (partial && body[f.name] === undefined) continue
    const value = coerce(f, body[f.name])
    if (f.kind === 'ref') await checkRef(f, value, campId)
    if (value !== undefined) data[f.name] = value
  }
  return data
}

const scopeWhere = (res: Resource, campId: string) =>
  res.scope === 'camp' ? { campId } : { eleve: { campId } }

// Espace propriétaire d'une ligne existante
const campOfRow = async (res: Resource, id: string): Promise<string> => {
  const row = res.scope === 'camp'
    ? await delegate(res.model).findUnique({ where: { id }, select: { campId: true } })
    : await delegate(res.model).findUnique({ where: { id }, select: { eleve: { select: { campId: true } } } })
  if (!row) throw new AppError('Élément introuvable', 404)
  return res.scope === 'camp' ? row.campId : row.eleve.campId
}

export const makeCrud = (res: Resource) => ({
  list: async (req: AuthRequest, out: Response, next: NextFunction) => {
    try {
      const campId = getCampId(req)
      const filters: Record<string, unknown> = {}
      for (const f of res.fields) {
        if (f.kind === 'ref' && req.query[f.name]) filters[f.name] = String(req.query[f.name])
      }
      const rows = await delegate(res.model).findMany({
        where: { ...scopeWhere(res, campId), ...filters },
        include: res.include,
        orderBy: res.orderBy,
      })
      sendSuccess(out, rows)
    } catch (err) { next(err) }
  },

  create: async (req: AuthRequest, out: Response, next: NextFunction) => {
    try {
      const campId = getCampId(req)
      const data = await buildData(res, req.body, campId, false)
      if (res.scope === 'camp') data.campId = campId
      if (res.setAuthor) data[res.setAuthor] = req.user!.userId

      let row
      if (res.unique) {
        const where = { [res.unique.join('_')]: Object.fromEntries(res.unique.map(k => [k, data[k]])) }
        row = await delegate(res.model).upsert({ where, create: data, update: data, include: res.include })
      } else {
        row = await delegate(res.model).create({ data, include: res.include })
      }
      sendCreated(out, row, 'Enregistré')
    } catch (err) { next(err) }
  },

  update: async (req: AuthRequest, out: Response, next: NextFunction) => {
    try {
      const campId = await campOfRow(res, req.params.id)
      const data = await buildData(res, req.body, campId, true)
      const row = await delegate(res.model).update({ where: { id: req.params.id }, data, include: res.include })
      sendSuccess(out, row, 'Mis à jour')
    } catch (err) { next(err) }
  },

  remove: async (req: AuthRequest, out: Response, next: NextFunction) => {
    try {
      await campOfRow(res, req.params.id)
      await delegate(res.model).delete({ where: { id: req.params.id } })
      sendSuccess(out, null, 'Supprimé')
    } catch (err) { next(err) }
  },
})

// ─── Rapport journalier ──────────────────────────────────────
const dayRange = (iso: string) => {
  const start = new Date(`${iso}T00:00:00.000Z`)
  if (isNaN(start.getTime())) throw new AppError('Date invalide', 400)
  return { start, end: new Date(start.getTime() + 86400000) }
}

export const getRapport = async (req: AuthRequest, out: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    const date = String(req.query.date ?? '')
    const { start, end } = dayRange(date)
    const inDay = { gte: start, lt: end }

    const [rapport, presents, absents, sorties, visiteurs, depenses, paiements] = await Promise.all([
      prisma.rapportJour.findUnique({ where: { campId_date: { campId, date: start } } }),
      prisma.presenceEleve.count({ where: { date: start, present: true, eleve: { campId } } }),
      prisma.presenceEleve.count({ where: { date: start, present: false, eleve: { campId } } }),
      prisma.sortieEleve.count({ where: { campId, heureSortie: inDay } }),
      prisma.visiteurEcole.count({ where: { campId, createdAt: inDay } }),
      prisma.depenseEcole.aggregate({ where: { campId, dateDepense: inDay }, _sum: { montant: true } }),
      prisma.paiementEleve.aggregate({ where: { eleve: { campId }, datePaiement: inDay }, _sum: { montant: true } }),
    ])
    sendSuccess(out, {
      rapport,
      auto: {
        presents, absents, sorties, visiteurs,
        depenses: Number(depenses._sum.montant ?? 0),
        encaisse: Number(paiements._sum.montant ?? 0),
      },
    })
  } catch (err) { next(err) }
}

export const saveRapport = async (req: AuthRequest, out: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    const { start } = dayRange(String(req.body.date ?? ''))
    const data = {
      resume: req.body.resume || null,
      incidents: req.body.incidents || null,
      observations: req.body.observations || null,
    }
    const rapport = await prisma.rapportJour.upsert({
      where: { campId_date: { campId, date: start } },
      create: { campId, date: start, ...data },
      update: data,
    })
    sendSuccess(out, rapport, 'Rapport enregistré')
  } catch (err) { next(err) }
}

// ─── Statistiques ────────────────────────────────────────────
export const getStatistiques = async (req: AuthRequest, out: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    const [camp, total, garcons, filles, classes, enseignants, encaisse, depenses, dons, presents, presencesTotal, evals, visiteurs, sorties] = await Promise.all([
      prisma.camp.findUnique({ where: { id: campId }, select: { prixBase: true } }),
      prisma.eleve.count({ where: { campId } }),
      prisma.eleve.count({ where: { campId, sexe: 'M' } }),
      prisma.eleve.count({ where: { campId, sexe: 'F' } }),
      prisma.classe.findMany({ where: { campId }, select: { id: true, nom: true, _count: { select: { eleves: true } } }, orderBy: { nom: 'asc' } }),
      prisma.enseignant.count({ where: { campId } }),
      prisma.paiementEleve.aggregate({ where: { eleve: { campId } }, _sum: { montant: true } }),
      prisma.depenseEcole.aggregate({ where: { campId }, _sum: { montant: true } }),
      prisma.donEcole.aggregate({ where: { campId }, _sum: { montant: true } }),
      prisma.presenceEleve.count({ where: { present: true, eleve: { campId } } }),
      prisma.presenceEleve.count({ where: { eleve: { campId } } }),
      prisma.evaluationEleve.groupBy({ by: ['couleur'], where: { eleve: { campId } }, _count: true }),
      prisma.visiteurEcole.count({ where: { campId } }),
      prisma.sortieEleve.count({ where: { campId } }),
    ])
    const encaisseN = Number(encaisse._sum.montant ?? 0)
    const attendu = Number(camp?.prixBase ?? 0) * total
    sendSuccess(out, {
      eleves: { total, garcons, filles },
      classes: classes.map(c => ({ id: c.id, nom: c.nom, total: c._count.eleves })),
      enseignants,
      finances: {
        attendu, encaisse: encaisseN, reste: Math.max(attendu - encaisseN, 0),
        depenses: Number(depenses._sum.montant ?? 0), dons: Number(dons._sum.montant ?? 0),
        solde: encaisseN + Number(dons._sum.montant ?? 0) - Number(depenses._sum.montant ?? 0),
      },
      presences: { taux: presencesTotal ? Math.round((presents / presencesTotal) * 100) : null },
      evaluations: Object.fromEntries(evals.map(e => [e.couleur, e._count])),
      visiteurs, sorties,
    })
  } catch (err) { next(err) }
}
