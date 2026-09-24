import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function initAdmin() {
  try {
    const count = await prisma.user.count()
    if (count > 0) return

    const email = process.env.ADMIN_EMAIL
    const password = process.env.ADMIN_PASSWORD
    if (!email || !password) {
      console.warn('⚠️  Aucun utilisateur en base : définissez ADMIN_EMAIL et ADMIN_PASSWORD pour créer le premier admin.')
      return
    }

    const hash = await bcrypt.hash(password, 12)
    await prisma.user.create({
      data: {
        nom: 'Système',
        prenom: 'Admin',
        email,
        motDePasseHash: hash,
        role: Role.SUPER_ADMIN,
      },
    })
    console.log(`✅ Compte admin créé : ${email}`)
  } catch (e) {
    console.error('initAdmin error:', e)
  } finally {
    await prisma.$disconnect()
  }
}
