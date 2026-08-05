/*
  Warnings:

  - Added the required column `metadata` to the `CompanyRepresentative` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "businessArea" TEXT,
ADD COLUMN     "contact" TEXT;

-- AlterTable
ALTER TABLE "CompanyRepresentative" ADD COLUMN     "metadata" JSONB NOT NULL,
ALTER COLUMN "position" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "currentVersion" SET DEFAULT 0;
