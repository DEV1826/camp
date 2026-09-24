-- CreateEnum
CREATE TYPE "TypeEspace" AS ENUM ('CAMP', 'ECOLE');

-- CreateEnum
CREATE TYPE "CouleurEval" AS ENUM ('VERT', 'JAUNE', 'ORANGE', 'ROUGE');

-- CreateEnum
CREATE TYPE "TypeProgramme" AS ENUM ('MENSUEL', 'HEBDOMADAIRE', 'MATIN', 'RYTHME_DE_VIE');

-- AlterTable
ALTER TABLE "camps" ADD COLUMN     "type" "TypeEspace" NOT NULL DEFAULT 'CAMP';

-- CreateTable
CREATE TABLE "eleves" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "prenom_mere" TEXT,
    "sexe" TEXT NOT NULL,
    "date_naissance" TIMESTAMP(3) NOT NULL,
    "lieu_naissance" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eleves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competences" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "competences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations_eleves" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "competence_id" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "couleur" "CouleurEval" NOT NULL,
    "commentaire" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_eleves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programmes_ecole" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "type" "TypeProgramme" NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programmes_ecole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presences_eleves" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "presences_eleves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eleves_camp_id_idx" ON "eleves"("camp_id");

-- CreateIndex
CREATE INDEX "competences_camp_id_idx" ON "competences"("camp_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_eleves_eleve_id_competence_id_periode_key" ON "evaluations_eleves"("eleve_id", "competence_id", "periode");

-- CreateIndex
CREATE INDEX "programmes_ecole_camp_id_idx" ON "programmes_ecole"("camp_id");

-- CreateIndex
CREATE UNIQUE INDEX "presences_eleves_eleve_id_date_key" ON "presences_eleves"("eleve_id", "date");

-- AddForeignKey
ALTER TABLE "eleves" ADD CONSTRAINT "eleves_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competences" ADD CONSTRAINT "competences_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_eleves" ADD CONSTRAINT "evaluations_eleves_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_eleves" ADD CONSTRAINT "evaluations_eleves_competence_id_fkey" FOREIGN KEY ("competence_id") REFERENCES "competences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programmes_ecole" ADD CONSTRAINT "programmes_ecole_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences_eleves" ADD CONSTRAINT "presences_eleves_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;
