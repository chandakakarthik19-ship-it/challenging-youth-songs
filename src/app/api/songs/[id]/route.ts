import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getAudioBucket, getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid song id" }, { status: 400 });
  const bucket = await getAudioBucket();
  if (!bucket) return NextResponse.json({ error: "MongoDB is not configured" }, { status: 503 });
  const files = await bucket.find({ _id: new ObjectId(id) }).toArray();
  if (!files[0]) return NextResponse.json({ error: "Song not found" }, { status: 404 });
  const file = files[0];
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

  const database = await getDatabase();
  const bucket = await getAudioBucket();
  if (!database || !bucket) return NextResponse.json({ error: "MongoDB is not configured" }, { status: 503 });

  const song = await database.collection("songs").findOne({ _id: new ObjectId(id) });
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  if (song.audioId instanceof ObjectId) {
    await bucket.delete(song.audioId);
  }
  await database.collection("songs").deleteOne({ _id: song._id });
  return NextResponse.json({ deleted: true });
}