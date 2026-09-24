import { Response, NextFunction } from 'express'
import prisma from '../config/prisma'
import { sendSuccess, sendCreated } from '../utils/response'
import { AppError } from '../middlewares/error.middleware'
import { AuthRequest } from '../types'

const COULEURS = ['VERT', 'JAUNE', 'ORANGE', 'ROUGE']
const TYPES_PROGRAMME = ['MENSUEL', 'HEBDOMADAIRE', 'MATIN', 'RYTHME_DE_VIE']

// campId : imposé par le middleware pour les non-super-admins, fourni par le client sinon
const getCampId = (req: AuthRequest): string => {
  const campId = String(req.query.campId ?? req.body?.campId ?? '')
  if (!campId) throw new AppError('campId requis', 400)
  return campId
}

const pick = (src: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter(k => src[k] !== undefined).map(k => [k, src[k]]))

const parseDate = (value: unknown, label = 'Date') => {
  const d = new Date(String(value))
  if (!value || isNaN(d.getTime())) throw new AppError(`${label} invalide`, 400)
  return d
}

// ─── ÉLÈVES ──────────────────────────────────────────────────
// Champ de la fiche → colonnes concernées (utilisé seulement si le super admin l'a activé)
const CHAMP_COLUMNS: Record<string, string[]> = {
  sexe: ['sexe'],
  dateNaissance: ['dateNaissance'],
  lieuNaissance: ['lieuNaissance'],
  parent: ['parentNom', 'parentPrenom'],
  telephoneParent: ['parentTelephone'],
  adresse: ['adresse'],
  infosMedicales: ['infosMedicales'],
  notes: ['notes'],
}

const ELEVE_INCLUDE = {
  classe: { select: { id: true, nom: true } },
  groupes: { select: { groupe: { select: { id: true, nom: true, couleur: true } } } },
} as const

const flattenEleve = <T extends { groupes: { groupe: unknown }[] }>(e: T) => ({ ...e, groupes: e.groupes.map(g => g.groupe) })

// Construit les données d'un élève en ne gardant que les champs activés pour cette école
const buildEleveData = async (campId: string, body: Record<string, any>) => {
  const camp = await prisma.camp.findUnique({ where: { id: campId }, select: { type: true, champsEleve: true } })
  if (!camp || camp.type !== 'ECOLE') throw new AppError('École introuvable', 404)
  const actifs = camp.champsEleve

  const data: Record<string, unknown> = {}
  for (const champ of actifs) {
    for (const col of CHAMP_COLUMNS[champ] ?? []) {
      if (body[col] === undefined) continue
      data[col] = col === 'dateNaissance' ? (body[col] ? parseDate(body[col], 'Date de naissance') : null) : (body[col] || null)
    }
  }
  if (data.sexe && !['M', 'F'].includes(data.sexe as string)) throw new AppError('Sexe invalide (M/F)', 400)

  let classeId: string | null | undefined
  if (actifs.includes('classe') && body.classeId !== undefined) {
    classeId = body.classeId || null
    if (classeId && !(await prisma.classe.findFirst({ where: { id: classeId, campId } }))) throw new AppError('Classe introuvable', 404)
  }

  let groupeIds: string[] | undefined
  if (actifs.includes('groupes') && Array.isArray(body.groupeEcoleIds)) {
    groupeIds = Array.from(new Set(body.groupeEcoleIds as string[]))
    if (await prisma.groupeEcole.count({ where: { id: { in: groupeIds }, campId } }) !== groupeIds.length) throw new AppError('Groupe introuvable', 404)
  }
  return { data, classeId, groupeIds }
}

export const getEleves = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    const search = req.query.search ? String(req.query.search) : ''
    const eleves = await prisma.eleve.findMany({
      where: {
        campId,
        ...(req.query.classeId && { classeId: String(req.query.classeId) }),
        ...(req.query.groupeId && { groupes: { some: { groupeId: String(req.query.groupeId) } } }),
        ...(search && { OR: [
          { nom: { contains: search, mode: 'insensitive' } },
          { prenom: { contains: search, mode: 'insensitive' } },
        ] }),
      },
      include: ELEVE_INCLUDE,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })
    sendSuccess(res, eleves.map(flattenEleve))
  } catch (err) { next(err) }
}

export const createEleve = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    const { nom, prenom } = req.body
    if (!nom || !prenom) throw new AppError('Nom et prénom requis', 400)
    const { data, classeId, groupeIds } = await buildEleveData(campId, req.body)
    const eleve = await prisma.eleve.create({
      data: {
        campId, nom, prenom, ...data,
        ...(classeId && { classeId }),
        ...(groupeIds && { groupes: { create: groupeIds.map(groupeId => ({ groupeId })) } }),
      },
      include: ELEVE_INCLUDE,
    })
    sendCreated(res, flattenEleve(eleve), 'Élève ajouté')
  } catch (err) { next(err) }
}

export const updateEleve = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.eleve.findUnique({ where: { id: req.params.id }, select: { campId: true } })
    if (!existing) throw new AppError('Élève introuvable', 404)
    const { data, classeId, groupeIds } = await buildEleveData(existing.campId, req.body)
    const eleve = await prisma.eleve.update({
      where: { id: req.params.id },
      data: {
        ...pick(req.body, ['nom', 'prenom']),
        ...data,
        ...(classeId !== undefined && { classeId }),
        ...(groupeIds && { groupes: { deleteMany: {}, create: groupeIds.map(groupeId => ({ groupeId })) } }),
      },
      include: ELEVE_INCLUDE,
    })
    sendSuccess(res, flattenEleve(eleve), 'Élève mis à jour')
  } catch (err) { next(err) }
}

export const deleteEleve = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.eleve.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Élève supprimé')
  } catch (err) { next(err) }
}

// Effectif, répartition par sexe, par classe et tableau des âges
export const getElevesStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    const [eleves, classes] = await Promise.all([
      prisma.eleve.findMany({ where: { campId }, select: { sexe: true, dateNaissance: true, classeId: true } }),
      prisma.classe.findMany({ where: { campId }, orderBy: { nom: 'asc' } }),
    ])
    const now = new Date()
    const parAge: Record<number, { age: number; garcons: number; filles: number; total: number }> = {}
    const parClasse: Record<string, { id: string; nom: string; garcons: number; filles: number; total: number }> = {}
    for (const c of classes) parClasse[c.id] = { id: c.id, nom: c.nom, garcons: 0, filles: 0, total: 0 }
    let garcons = 0, filles = 0
    for (const e of eleves) {
      if (e.sexe === 'M') garcons++; else if (e.sexe === 'F') filles++
      if (e.dateNaissance) {
        const b = e.dateNaissance
        let age = now.getFullYear() - b.getFullYear()
        if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
        const row = (parAge[age] ??= { age, garcons: 0, filles: 0, total: 0 })
        if (e.sexe === 'M') row.garcons++; else if (e.sexe === 'F') row.filles++
        row.total++
      }
      const cl = e.classeId ? parClasse[e.classeId] : undefined
      if (cl) { cl.total++; if (e.sexe === 'M') cl.garcons++; else if (e.sexe === 'F') cl.filles++ }
    }
    sendSuccess(res, {
      total: eleves.length, garcons, filles,
      parAge: Object.values(parAge).sort((a, b) => a.age - b.age),
      parClasse: Object.values(parClasse),
    })
  } catch (err) { next(err) }
}

// ─── CLASSES ─────────────────────────────────────────────────
export const getClasses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await prisma.classe.findMany({
      where: { campId: getCampId(req) }, orderBy: { nom: 'asc' },
      include: { _count: { select: { eleves: true } } },
    }))
  } catch (err) { next(err) }
}

export const createClasse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    if (!req.body.nom) throw new AppError('Nom requis', 400)
    sendCreated(res, await prisma.classe.create({ data: { campId, nom: req.body.nom, niveau: req.body.niveau || null } }), 'Classe ajoutée')
  } catch (err) { next(err) }
}

export const updateClasse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await prisma.classe.update({ where: { id: req.params.id }, data: pick(req.body, ['nom', 'niveau']) }), 'Classe mise à jour')
  } catch (err) { next(err) }
}

export const deleteClasse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.classe.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Classe supprimée')
  } catch (err) { next(err) }
}

// ─── GROUPES D'ÉCOLE ─────────────────────────────────────────
export const getGroupesEcole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const groupes = await prisma.groupeEcole.findMany({
      where: { campId: getCampId(req) }, orderBy: { nom: 'asc' },
      include: { eleves: { select: { eleve: { select: { id: true, nom: true, prenom: true } } } } },
    })
    sendSuccess(res, groupes.map(g => ({ ...g, eleves: g.eleves.map(x => x.eleve) })))
  } catch (err) { next(err) }
}

export const createGroupeEcole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    if (!req.body.nom) throw new AppError('Nom requis', 400)
    sendCreated(res, await prisma.groupeEcole.create({
      data: { campId, nom: req.body.nom, couleur: req.body.couleur || undefined, description: req.body.description || null },
    }), 'Groupe ajouté')
  } catch (err) { next(err) }
}

export const updateGroupeEcole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await prisma.groupeEcole.update({ where: { id: req.params.id }, data: pick(req.body, ['nom', 'couleur', 'description']) }), 'Groupe mis à jour')
  } catch (err) { next(err) }
}

export const deleteGroupeEcole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.groupeEcole.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Groupe supprimé')
  } catch (err) { next(err) }
}

// ─── COMPÉTENCES ─────────────────────────────────────────────
export const getCompetences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await prisma.competence.findMany({ where: { campId: getCampId(req) }, orderBy: [{ ordre: 'asc' }, { nom: 'asc' }] }))
  } catch (err) { next(err) }
}

export const createCompetence = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    if (!req.body.nom) throw new AppError('Nom requis', 400)
    const ordre = await prisma.competence.count({ where: { campId } })
    sendCreated(res, await prisma.competence.create({ data: { campId, nom: req.body.nom, ordre } }), 'Compétence ajoutée')
  } catch (err) { next(err) }
}

export const updateCompetence = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await prisma.competence.update({ where: { id: req.params.id }, data: pick(req.body, ['nom', 'ordre']) }), 'Compétence mise à jour')
  } catch (err) { next(err) }
}

export const deleteCompetence = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.competence.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Compétence supprimée')
  } catch (err) { next(err) }
}

// ─── ÉVALUATIONS (couleurs) ──────────────────────────────────
export const getEvaluations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    const periode = String(req.query.periode ?? '')
    if (!periode) throw new AppError('periode requise', 400)
    sendSuccess(res, await prisma.evaluationEleve.findMany({ where: { periode, eleve: { campId } } }))
  } catch (err) { next(err) }
}

// Crée / met à jour une évaluation ; couleur null = suppression
export const setEvaluation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { eleveId, competenceId, periode, couleur, commentaire } = req.body
    if (!eleveId || !competenceId || !periode) throw new AppError('eleveId, competenceId et periode requis', 400)

    const [eleve, competence] = await Promise.all([
      prisma.eleve.findUnique({ where: { id: eleveId }, select: { campId: true } }),
      prisma.competence.findUnique({ where: { id: competenceId }, select: { campId: true } }),
    ])
    if (!eleve || !competence || eleve.campId !== competence.campId) throw new AppError('Élève ou compétence introuvable', 404)

    const key = { eleveId_competenceId_periode: { eleveId, competenceId, periode } }
    if (couleur === null) {
      await prisma.evaluationEleve.deleteMany({ where: { eleveId, competenceId, periode } })
      return sendSuccess(res, null, 'Évaluation supprimée')
    }
    if (!COULEURS.includes(couleur)) throw new AppError(`Couleur invalide (${COULEURS.join(', ')})`, 400)
    const evaluation = await prisma.evaluationEleve.upsert({
      where: key,
      update: { couleur, ...(commentaire !== undefined && { commentaire }) },
      create: { eleveId, competenceId, periode, couleur, commentaire },
    })
    sendSuccess(res, evaluation, 'Évaluation enregistrée')
  } catch (err) { next(err) }
}

// ─── PROGRAMME ───────────────────────────────────────────────
export const getProgrammes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const type = req.query.type ? String(req.query.type) : undefined
    sendSuccess(res, await prisma.programmeEcole.findMany({
      where: { campId: getCampId(req), ...(type && { type: type as never }) },
      orderBy: { date: 'desc' },
    }))
  } catch (err) { next(err) }
}

export const createProgramme = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    const { type, titre, contenu, date } = req.body
    if (!TYPES_PROGRAMME.includes(type) || !titre || !contenu) throw new AppError('Type, titre et contenu requis', 400)
    sendCreated(res, await prisma.programmeEcole.create({ data: { campId, type, titre, contenu, date: parseDate(date) } }), 'Programme ajouté')
  } catch (err) { next(err) }
}

export const updateProgramme = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data: Record<string, unknown> = pick(req.body, ['titre', 'contenu'])
    if (req.body.type !== undefined) {
      if (!TYPES_PROGRAMME.includes(req.body.type)) throw new AppError('Type invalide', 400)
      data.type = req.body.type
    }
    if (req.body.date !== undefined) data.date = parseDate(req.body.date)
    sendSuccess(res, await prisma.programmeEcole.update({ where: { id: req.params.id }, data }), 'Programme mis à jour')
  } catch (err) { next(err) }
}

export const deleteProgramme = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.programmeEcole.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Programme supprimé')
  } catch (err) { next(err) }
}

// ─── PRÉSENCES (appel quotidien) ─────────────────────────────
export const getPresences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    sendSuccess(res, await prisma.presenceEleve.findMany({ where: { date: parseDate(req.query.date), eleve: { campId } } }))
  } catch (err) { next(err) }
}

export const savePresences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campId = getCampId(req)
    const date = parseDate(req.body.date)
    const presences: { eleveId: string; present: boolean }[] = Array.isArray(req.body.presences) ? req.body.presences : []

    const ids = presences.map(p => p.eleveId)
    const owned = await prisma.eleve.count({ where: { id: { in: ids }, campId } })
    if (owned !== new Set(ids).size) throw new AppError('Élève introuvable dans cette école', 404)

    await prisma.$transaction(presences.map(p => prisma.presenceEleve.upsert({
      where: { eleveId_date: { eleveId: p.eleveId, date } },
      update: { present: Boolean(p.present) },
      create: { eleveId: p.eleveId, date, present: Boolean(p.present) },
    })))
    sendSuccess(res, null, 'Appel enregistré')
  } catch (err) { next(err) }
}
