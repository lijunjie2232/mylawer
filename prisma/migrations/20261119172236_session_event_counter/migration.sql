-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "eventSeq" INTEGER NOT NULL DEFAULT 0;

-- 既存イベントがあるセッションは、最大 seq から採番を続ける
UPDATE "ChatSession" AS c
SET "eventSeq" = COALESCE(
  (SELECT MAX(e."seq") FROM "SessionEvent" AS e WHERE e."sessionId" = c."id"),
  0
);
