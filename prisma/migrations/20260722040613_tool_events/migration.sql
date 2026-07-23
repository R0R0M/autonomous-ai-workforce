-- CreateTable
CREATE TABLE "ToolEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "agent" "AgentName" NOT NULL,
    "tool" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolEvent_repositoryId_createdAt_idx" ON "ToolEvent"("repositoryId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolEvent_runId_createdAt_idx" ON "ToolEvent"("runId", "createdAt");

-- AddForeignKey
ALTER TABLE "ToolEvent" ADD CONSTRAINT "ToolEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CycleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolEvent" ADD CONSTRAINT "ToolEvent_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
