-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "timestamp" TEXT NOT NULL PRIMARY KEY,
    "deployId" TEXT,
    "channelDeployId" TEXT NOT NULL,
    "threadId" TEXT,
    "content" TEXT,
    "files" TEXT,
    "type" INTEGER NOT NULL,
    "isPinned" BOOLEAN NOT NULL,
    "isReplyed" BOOLEAN NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorType" INTEGER NOT NULL,
    "authorColor" INTEGER NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorImageUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Message" ("authorColor", "authorId", "authorImageUrl", "authorName", "authorType", "channelDeployId", "content", "createdAt", "deployId", "files", "isPinned", "isReplyed", "threadId", "timestamp", "type", "updatedAt") SELECT "authorColor", "authorId", "authorImageUrl", "authorName", "authorType", "channelDeployId", "content", "createdAt", "deployId", "files", "isPinned", "isReplyed", "threadId", "timestamp", "type", "updatedAt" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE UNIQUE INDEX "Message_deployId_key" ON "Message"("deployId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
