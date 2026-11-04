-- P2-T4: secreto de asiento (uuid por fila, backfill incluido vía DEFAULT).
ALTER TABLE "players" ADD COLUMN "secret" TEXT NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "players_secret_key" ON "players"("secret");
