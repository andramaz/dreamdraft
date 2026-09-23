-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "eaId" INTEGER NOT NULL,
    "gameVersion" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "club" TEXT NOT NULL,
    "clubId" INTEGER,
    "clubSource" TEXT,
    "pace" INTEGER,
    "shooting" INTEGER,
    "passing" INTEGER,
    "dribbling" INTEGER,
    "defending" INTEGER,
    "physical" INTEGER,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_gameVersion_position_idx" ON "Player"("gameVersion", "position");

-- CreateIndex
CREATE INDEX "Player_gameVersion_club_idx" ON "Player"("gameVersion", "club");

-- CreateIndex
CREATE INDEX "Player_gameVersion_rating_idx" ON "Player"("gameVersion", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "Player_eaId_gameVersion_key" ON "Player"("eaId", "gameVersion");
