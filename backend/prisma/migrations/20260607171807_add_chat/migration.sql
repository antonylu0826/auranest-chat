-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'CHAT_CHANNEL_READ';
ALTER TYPE "Permission" ADD VALUE 'CHAT_CHANNEL_CREATE';
ALTER TYPE "Permission" ADD VALUE 'CHAT_CHANNEL_DELETE';
ALTER TYPE "Permission" ADD VALUE 'CHAT_MESSAGE_DELETE';

-- CreateTable
CREATE TABLE "chat_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "topic" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_channel_members" (
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channel_members_pkey" PRIMARY KEY ("channel_id","user_id")
);

-- CreateTable
CREATE TABLE "chat_direct_conversations" (
    "id" TEXT NOT NULL,
    "participants_hash" TEXT NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_direct_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_dm_participants" (
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "chat_dm_participants_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'USER',
    "content" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "channel_id" TEXT,
    "dm_id" TEXT,
    "parent_id" TEXT,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "client_nonce" TEXT,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message_revisions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editor_id" TEXT NOT NULL,

    CONSTRAINT "chat_message_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_mentions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "mentioned_user_id" TEXT,
    "mention_type" TEXT NOT NULL,

    CONSTRAINT "chat_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_channel_reads" (
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_message_id" TEXT,
    "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channel_reads_pkey" PRIMARY KEY ("channel_id","user_id")
);

-- CreateTable
CREATE TABLE "chat_dm_reads" (
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_message_id" TEXT,
    "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_dm_reads_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "chat_reactions" (
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_reactions_pkey" PRIMARY KEY ("message_id","user_id","emoji")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_channels_slug_key" ON "chat_channels"("slug");

-- CreateIndex
CREATE INDEX "chat_channel_members_user_id_idx" ON "chat_channel_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_direct_conversations_participants_hash_key" ON "chat_direct_conversations"("participants_hash");

-- CreateIndex
CREATE INDEX "chat_dm_participants_user_id_idx" ON "chat_dm_participants"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_channel_id_created_at_idx" ON "chat_messages"("channel_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_dm_id_created_at_idx" ON "chat_messages"("dm_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_parent_id_idx" ON "chat_messages"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_sender_id_client_nonce_key" ON "chat_messages"("sender_id", "client_nonce");

-- CreateIndex
CREATE INDEX "chat_message_revisions_message_id_idx" ON "chat_message_revisions"("message_id");

-- CreateIndex
CREATE INDEX "chat_mentions_mentioned_user_id_idx" ON "chat_mentions"("mentioned_user_id");

-- CreateIndex
CREATE INDEX "chat_reactions_message_id_idx" ON "chat_reactions"("message_id");

-- CreateIndex
CREATE INDEX "chat_reactions_user_id_idx" ON "chat_reactions"("user_id");

-- AddForeignKey
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_channel_members" ADD CONSTRAINT "chat_channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_channel_members" ADD CONSTRAINT "chat_channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_dm_participants" ADD CONSTRAINT "chat_dm_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_direct_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_dm_participants" ADD CONSTRAINT "chat_dm_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_dm_id_fkey" FOREIGN KEY ("dm_id") REFERENCES "chat_direct_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_revisions" ADD CONSTRAINT "chat_message_revisions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mentions" ADD CONSTRAINT "chat_mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_reactions" ADD CONSTRAINT "chat_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_reactions" ADD CONSTRAINT "chat_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Custom: enforce exactly one of channel_id / dm_id must be set (XOR).
-- Prisma cannot express CHECK constraints; added manually.
ALTER TABLE "chat_messages" ADD CONSTRAINT "chk_channel_xor_dm"
  CHECK ((channel_id IS NULL) <> (dm_id IS NULL));
