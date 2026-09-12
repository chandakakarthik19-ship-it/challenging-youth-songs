import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { unzipSync } from "fflate";
import { getStorageTargets } from "@/lib/mongodb";

export const runtime = "nodejs";
export const maxDuration = 60;
const supportedAudio = /\.(mp3|wav|m4a|ogg|aac)$/i;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const upload = formData.get("file");
    if (!(upload instanceof File) || (!supportedAudio.test(upload.name) && !upload.name.toLowerCase().endsWith(".zip"))) {
      return NextResponse.json({ error: "Please choose an audio file or ZIP archive." }, { status: 400 });
    }
    const folder = String(formData.get("folder") ?? "").trim();
    if (!folder) return NextResponse.json({ error: "Please choose a folder for the song." }, { status: 400 });
    const stores = await getStorageTargets();
    if (!stores.length) return NextResponse.json({ error: "Add MONGODB_URI to .env.local first." }, { status: 503 });

    const entries = upload.name.toLowerCase().endsWith(".zip")
      ? Object.entries(unzipSync(new Uint8Array(await upload.arrayBuffer()))).filter(([name]) => supportedAudio.test(name))
      : [[upload.name, new Uint8Array(await upload.arrayBuffer())] as [string, Uint8Array]];
    if (!entries.length) return NextResponse.json({ error: "No supported audio files found." }, { status: 400 });

    for (const [entryName, entryFile] of entries) {
      const cleanName = entryName.split("/").pop() ?? entryName;
      const title = cleanName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
      const file = Buffer.from(entryFile);
      let stored = false;
      let lastError: unknown;
      for (const { bucket, database } of stores) {
        let uploadStream: ReturnType<typeof bucket.openUploadStream> | undefined;
        try {
          uploadStream = bucket.openUploadStream(cleanName, { metadata: { originalName: cleanName, contentType: audioContentType(cleanName) } });
          await new Promise<void>((resolve, reject) => Readable.from(file).pipe(uploadStream!).on("finish", resolve).on("error", reject));
          await database.collection("songs").insertOne({ title, artist: "Vinayaka Chavithi DJ", category: folder, audioId: uploadStream.id, createdAt: new Date() });
          stored = true;
          break;
        } catch (error) {
          lastError = error;
          if (uploadStream) await bucket.delete(uploadStream.id).catch(() => undefined);
        }
      }
      if (!stored) throw lastError;
    }
    return NextResponse.json({ uploaded: entries.length });
  } catch (error) {
    console.error("Unable to upload songs", error);
    const message = error instanceof Error && error.message.includes("querySrv")
      ? "MongoDB Atlas hostname could not be resolved. Update MONGODB_URI with the current Atlas connection string."
      : "Upload failed. Check your MongoDB connection and try again.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

function audioContentType(name: string) {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "wav" ? "audio/wav" : extension === "m4a" ? "audio/mp4" : extension === "ogg" ? "audio/ogg" : "audio/mpeg";
}