-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "room_code" TEXT NOT NULL,
    "host_user_id" TEXT NOT NULL,
    "current_video_id" TEXT,
    "current_title" TEXT,
    "current_thumbnail_url" TEXT,
    "current_duration" DOUBLE PRECISION,
    "is_playing" BOOLEAN NOT NULL DEFAULT false,
    "playback_position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "playback_updated_at" TIMESTAMP(3),
    "playback_updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_members" (
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_members_pkey" PRIMARY KEY ("room_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_room_code_key" ON "rooms"("room_code");

-- CreateIndex
CREATE INDEX "rooms_host_user_id_idx" ON "rooms"("host_user_id");

-- CreateIndex
CREATE INDEX "room_members_user_id_idx" ON "room_members"("user_id");

-- CreateIndex
CREATE INDEX "messages_room_id_created_at_idx" ON "messages"("room_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_playback_updated_by_fkey" FOREIGN KEY ("playback_updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
