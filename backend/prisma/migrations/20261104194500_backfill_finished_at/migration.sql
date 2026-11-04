UPDATE "rooms" SET "finishedAt" = NOW() WHERE status = 'FINISHED' AND "finishedAt" IS NULL;
