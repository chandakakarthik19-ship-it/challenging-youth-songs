import { GridFSFile, ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getStorageTargets } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid song id" }, { status: 400 });
  const stores = await getStorageTargets();
  if (!stores.length) return NextResponse.json({ error: "MongoDB is not configured" }, { status: 503 });
  let bucket = stores[0].bucket;
  let file: GridFSFile | null = null;
  for (const store of stores) {
    const matches = await store.bucket.find({ _id: new ObjectId(id) }).toArray();
    if (matches[0]) { bucket = store.bucket; file = matches[0]; break; }
  }
  if (!file) return NextResponse.json({ error: "Song not found" }, { status: 404 });
  const range = _request.headers.get("range");
  const requestedRange = range?.match(/^bytes=(\d*)-(\d*)$/);
  const start = requestedRange?.[1] ? Number(requestedRange[1]) : 0;
  const end = requestedRange?.[2] ? Math.min(Number(requestedRange[2]), file.length - 1) : file.length - 1;
  if (start >= file.length || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.length}` } });
  }
  const isPartial = Boolean(requestedRange);
  const stream = bucket.openDownloadStream(file._id, { start, end: end + 1 });
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk)));
      stream.on("end", () => controller.close());
      stream.on("error", (error) => controller.error(error));
    },
    cancel() { stream.destroy(); },
  });
  return new Response(webStream, { status: isPartial ? 206 : 200, headers: {
    "Content-Type": file.metadata?.contentType ?? "audio/mpeg",
    "Content-Length": String(end - start + 1),
    ...(isPartial ? { "Content-Range": `bytes ${start}-${end}/${file.length}` } : {}),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid song id" }, { status: 400 });

  const stores = await getStorageTargets();
  if (!stores.length) return NextResponse.json({ error: "MongoDB is not configured" }, { status: 503 });

  let matchedStore = stores[0];
  let song = null;
  for (const store of stores) {
    song = await store.database.collection("songs").findOne({ _id: new ObjectId(id) });
    if (song) { matchedStore = store; break; }
  }
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  if (song.audioId instanceof ObjectId) {
    await matchedStore.bucket.delete(song.audioId);
  }
  await matchedStore.database.collection("songs").deleteOne({ _id: song._id });
  return NextResponse.json({ deleted: true });
}