-- AlterEnum
ALTER TYPE "RoomStatus" ADD VALUE 'VOTING';

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "isEliminated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "currentRound" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "votedForId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "votes_roomId_voterId_round_key" ON "votes"("roomId", "voterId", "round");

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_votedForId_fkey" FOREIGN KEY ("votedForId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
