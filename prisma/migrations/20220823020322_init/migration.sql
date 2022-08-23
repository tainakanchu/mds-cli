-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deployId" TEXT,
    "name" TEXT NOT NULL,
    "categoryDeployId" TEXT,
    "type" INTEGER NOT NULL,
    "topic" TEXT,
    "isArchived" BOOLEAN NOT NULL,
    "pins" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deployId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT,
    "botId" TEXT,
    "name" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "color" INTEGER NOT NULL,
    "email" TEXT,
    "imageUrl" TEXT NOT NULL,
    "isBot" BOOLEAN NOT NULL,
    "isDeleted" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Message" (
    "timestamp" TEXT NOT NULL PRIMARY KEY,
    "deployId" TEXT,
    "channelDeployId" TEXT NOT NULL,
    "threadId" TEXT,
    "content" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "Channel_deployId_key" ON "Channel"("deployId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_deployId_key" ON "Category"("deployId");

-- CreateIndex
CREATE UNIQUE INDEX "User_appId_key" ON "User"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "User_botId_key" ON "User"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Message_deployId_key" ON "Message"("deployId");
