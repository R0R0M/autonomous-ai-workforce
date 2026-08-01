-- AlterEnum
ALTER TYPE "RunPhase" ADD VALUE 'AWAITING_IDEA_APPROVAL';

-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "model" TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
ADD COLUMN     "requireIdeaApproval" BOOLEAN NOT NULL DEFAULT false;
