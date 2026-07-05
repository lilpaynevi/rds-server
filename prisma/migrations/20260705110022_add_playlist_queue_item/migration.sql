-- CreateTable
CREATE TABLE "playlist_queue_items" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "televisionId" TEXT NOT NULL,

    CONSTRAINT "playlist_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "playlist_queue_items_playlistId_televisionId_key" ON "playlist_queue_items"("playlistId", "televisionId");

-- AddForeignKey
ALTER TABLE "playlist_queue_items" ADD CONSTRAINT "playlist_queue_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_queue_items" ADD CONSTRAINT "playlist_queue_items_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_queue_items" ADD CONSTRAINT "playlist_queue_items_televisionId_fkey" FOREIGN KEY ("televisionId") REFERENCES "televisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
