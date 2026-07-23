-- CreateEnum
CREATE TYPE "RepoStatus" AS ENUM ('IDLE', 'RUNNING', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "ScheduleMode" AS ENUM ('CONTINUOUS', 'NIGHTLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "MergeMode" AS ENUM ('PULL_REQUEST', 'DIRECT_MERGE');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('BACKLOG', 'ACTIVE', 'DONE', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RunPhase" AS ENUM ('IDEATING', 'CODING', 'TESTING', 'FIXING', 'SAFETY_CHECK', 'PUSHING', 'AWAITING_APPROVAL', 'MERGING', 'DEPLOYING', 'VERIFYING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "AgentName" AS ENUM ('IDEATOR', 'CODER', 'TESTER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'FIXED', 'WONT_FIX');

-- CreateEnum
CREATE TYPE "DeployStatus" AS ENUM ('TRIGGERED', 'VERIFYING', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "githubTokenEnc" TEXT NOT NULL,
    "schedule" "ScheduleMode" NOT NULL DEFAULT 'CONTINUOUS',
    "mergeMode" "MergeMode" NOT NULL DEFAULT 'PULL_REQUEST',
    "autoMergePr" BOOLEAN NOT NULL DEFAULT true,
    "requireHumanApproval" BOOLEAN NOT NULL DEFAULT false,
    "deployHookUrl" TEXT,
    "healthCheckUrl" TEXT,
    "status" "RepoStatus" NOT NULL DEFAULT 'IDLE',
    "lastCycleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "acceptanceCriteria" JSONB NOT NULL,
    "filesLikelyAffected" JSONB NOT NULL,
    "dependencies" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "successMetrics" JSONB NOT NULL,
    "scores" JSONB NOT NULL,
    "priority" INTEGER NOT NULL,
    "status" "IdeaStatus" NOT NULL DEFAULT 'BACKLOG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleRun" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "ideaId" TEXT,
    "phase" "RunPhase" NOT NULL DEFAULT 'IDEATING',
    "branchName" TEXT,
    "prNumber" INTEGER,
    "mergeCommitSha" TEXT,
    "fixIteration" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CycleRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "fromAgent" "AgentName" NOT NULL,
    "toAgent" "AgentName" NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "severity" "BugSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stepsToReproduce" TEXT NOT NULL,
    "expectedBehavior" TEXT NOT NULL,
    "actualBehavior" TEXT NOT NULL,
    "logs" TEXT,
    "likelyFiles" JSONB NOT NULL,
    "suggestedFixes" TEXT NOT NULL,
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "status" "DeployStatus" NOT NULL,
    "commitSha" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEntry" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "agent" "AgentName" NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "runId" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_userId_owner_name_key" ON "Repository"("userId", "owner", "name");

-- CreateIndex
CREATE INDEX "Idea_repositoryId_status_priority_idx" ON "Idea"("repositoryId", "status", "priority");

-- CreateIndex
CREATE INDEX "CycleRun_repositoryId_phase_idx" ON "CycleRun"("repositoryId", "phase");

-- CreateIndex
CREATE INDEX "AgentMessage_repositoryId_createdAt_idx" ON "AgentMessage"("repositoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Deployment_repositoryId_createdAt_idx" ON "Deployment"("repositoryId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryEntry_repositoryId_agent_createdAt_idx" ON "MemoryEntry"("repositoryId", "agent", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_repositoryId_createdAt_idx" ON "ActivityLog"("repositoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleRun" ADD CONSTRAINT "CycleRun_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleRun" ADD CONSTRAINT "CycleRun_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CycleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CycleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CycleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
