-- AlterTable
ALTER TABLE "users" ADD COLUMN "camp_id" TEXT,
ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "users_camp_id_idx" ON "users"("camp_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
