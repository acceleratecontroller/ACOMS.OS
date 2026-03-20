-- CreateEnum
CREATE TYPE "TrainingRoleCategory" AS ENUM ('OFFICE', 'FIELD');

-- CreateEnum
CREATE TYPE "AccreditationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'EXEMPT');

-- CreateTable
CREATE TABLE "TrainingRole" (
    "id" TEXT NOT NULL,
    "roleNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "TrainingRoleCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,

    CONSTRAINT "TrainingRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSkill" (
    "id" TEXT NOT NULL,
    "skillNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,

    CONSTRAINT "TrainingSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accreditation" (
    "id" TEXT NOT NULL,
    "accreditationNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,

    CONSTRAINT "Accreditation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleSkillLink" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "RoleSkillLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillAccreditationLink" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "accreditationId" TEXT NOT NULL,

    CONSTRAINT "SkillAccreditationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRole" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAccreditation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "accreditationId" TEXT NOT NULL,
    "status" "AccreditationStatus" NOT NULL DEFAULT 'PENDING',
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "certificateNumber" TEXT,
    "notes" TEXT,
    "evidenceFileName" TEXT,
    "evidenceFileUrl" TEXT,
    "evidenceNotes" TEXT,

    CONSTRAINT "EmployeeAccreditation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRole_roleNumber_key" ON "TrainingRole"("roleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSkill_skillNumber_key" ON "TrainingSkill"("skillNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Accreditation_accreditationNumber_key" ON "Accreditation"("accreditationNumber");

-- CreateIndex
CREATE INDEX "RoleSkillLink_roleId_idx" ON "RoleSkillLink"("roleId");

-- CreateIndex
CREATE INDEX "RoleSkillLink_skillId_idx" ON "RoleSkillLink"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleSkillLink_roleId_skillId_key" ON "RoleSkillLink"("roleId", "skillId");

-- CreateIndex
CREATE INDEX "SkillAccreditationLink_skillId_idx" ON "SkillAccreditationLink"("skillId");

-- CreateIndex
CREATE INDEX "SkillAccreditationLink_accreditationId_idx" ON "SkillAccreditationLink"("accreditationId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillAccreditationLink_skillId_accreditationId_key" ON "SkillAccreditationLink"("skillId", "accreditationId");

-- CreateIndex
CREATE INDEX "EmployeeRole_employeeId_idx" ON "EmployeeRole"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeRole_roleId_idx" ON "EmployeeRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeRole_employeeId_roleId_key" ON "EmployeeRole"("employeeId", "roleId");

-- CreateIndex
CREATE INDEX "EmployeeAccreditation_employeeId_idx" ON "EmployeeAccreditation"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeAccreditation_accreditationId_idx" ON "EmployeeAccreditation"("accreditationId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAccreditation_employeeId_accreditationId_key" ON "EmployeeAccreditation"("employeeId", "accreditationId");

-- AddForeignKey
ALTER TABLE "TrainingRole" ADD CONSTRAINT "TrainingRole_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRole" ADD CONSTRAINT "TrainingRole_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSkill" ADD CONSTRAINT "TrainingSkill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSkill" ADD CONSTRAINT "TrainingSkill_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accreditation" ADD CONSTRAINT "Accreditation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accreditation" ADD CONSTRAINT "Accreditation_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleSkillLink" ADD CONSTRAINT "RoleSkillLink_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TrainingRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleSkillLink" ADD CONSTRAINT "RoleSkillLink_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "TrainingSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAccreditationLink" ADD CONSTRAINT "SkillAccreditationLink_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "TrainingSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAccreditationLink" ADD CONSTRAINT "SkillAccreditationLink_accreditationId_fkey" FOREIGN KEY ("accreditationId") REFERENCES "Accreditation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRole" ADD CONSTRAINT "EmployeeRole_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRole" ADD CONSTRAINT "EmployeeRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TrainingRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAccreditation" ADD CONSTRAINT "EmployeeAccreditation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAccreditation" ADD CONSTRAINT "EmployeeAccreditation_accreditationId_fkey" FOREIGN KEY ("accreditationId") REFERENCES "Accreditation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
