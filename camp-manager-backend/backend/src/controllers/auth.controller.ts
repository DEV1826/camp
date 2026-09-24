import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../config/prisma'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { sendSuccess, sendError, sendCreated } from '../utils/response'
import { AppError } from '../middlewares/error.middleware'
import { AuthRequest } from '../types'

// ─── POST /auth/register ─────────────────────────────────────
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, prenom, email, motDePasse, role, campId, permissions } = req.body

    if (!nom || !prenom || !email || typeof motDePasse !== 'string' || motDePasse.length < 8) {
      throw new AppError('Nom, prénom, email et mot de passe (8 caractères min.) requis', 400)
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) throw new AppError('Cet email est déjà utilisé', 409)

    const hash = await bcrypt.hash(motDePasse, 12)

    const user = await prisma.user.create({
      data: { nom, prenom, email, motDePasseHash: hash, role: role || 'ADMIN', campId: campId || null, permissions: Array.isArray(permissions) ? permissions : [] },
      select: { id: true, nom: true, prenom: true, email: true, role: true, campId: true, permissions: true, createdAt: true },
    })

    const payload = { userId: user.id, email: user.email, role: user.role }
    const accessToken = generateAccessToken(payload)
    const refreshToken = generateRefreshToken(payload)

    sendCreated(res, { user, accessToken, refreshToken }, 'Compte créé avec succès')
  } catch (err) {
    next(err)
  }
}

// ─── POST /auth/login ────────────────────────────────────────
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, motDePasse } = req.body
    if (typeof email !== 'string' || typeof motDePasse !== 'string') {
      throw new AppError('Email et mot de passe requis', 400)
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { camp: { select: { type: true, nom: true } } } })
    if (!user || !user.actif) throw new AppError('Email ou mot de passe incorrect', 401)

    const valid = await bcrypt.compare(motDePasse, user.motDePasseHash)
    if (!valid) throw new AppError('Email ou mot de passe incorrect', 401)

    await prisma.user.update({
      where: { id: user.id },
      data: { dernierLogin: new Date() },
    })

    const payload = { userId: user.id, email: user.email, role: user.role }
    const accessToken = generateAccessToken(payload)
    const refreshToken = generateRefreshToken(payload)

    sendSuccess(res, {
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role, avatarUrl: user.avatarUrl, campId: user.campId, permissions: user.permissions, campType: user.camp?.type ?? null, campNom: user.camp?.nom ?? null },
      accessToken,
      refreshToken,
    }, 'Connexion réussie')
  } catch (err) {
    next(err)
  }
}

// ─── POST /auth/refresh ──────────────────────────────────────
export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) throw new AppError('Refresh token manquant', 400)

    const payload = verifyRefreshToken(refreshToken)

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user || !user.actif) throw new AppError('Utilisateur introuvable', 401)

    const newPayload = { userId: user.id, email: user.email, role: user.role }
    const accessToken = generateAccessToken(newPayload)
    const newRefreshToken = generateRefreshToken(newPayload)

    sendSuccess(res, { accessToken, refreshToken: newRefreshToken }, 'Token renouvelé')
  } catch (err) {
    next(err)
  }
}

// ─── GET /auth/me ────────────────────────────────────────────
export const me = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        avatarUrl: true,
        campId: true,
        permissions: true,
        camp: { select: { type: true, nom: true } },
        dernierLogin: true,
        createdAt: true,
      },
    })
    if (!user) throw new AppError('Utilisateur introuvable', 404)

    const { camp, ...rest } = user
    sendSuccess(res, { ...rest, campType: camp?.type ?? null, campNom: camp?.nom ?? null })
  } catch (err) {
    next(err)
  }
}

// ─── PUT /auth/password ──────────────────────────────────────
export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) throw new AppError('Utilisateur introuvable', 404)

    const valid = await bcrypt.compare(ancienMotDePasse, user.motDePasseHash)
    if (!valid) throw new AppError('Ancien mot de passe incorrect', 401)

    const hash = await bcrypt.hash(nouveauMotDePasse, 12)
    await prisma.user.update({ where: { id: user.id }, data: { motDePasseHash: hash } })

    sendSuccess(res, null, 'Mot de passe modifié avec succès')
  } catch (err) {
    next(err)
  }
}
