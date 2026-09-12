import { NextResponse } from "next/server";
import { getStorageTargets } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stores = await getStorageTargets();
    if (!stores.length) return NextResponse.json({ songs: [], configured: false });
    const results = await Promise.allSettled(stores.map(({ database }) => database.collection("songs").find({}).sort({ createdAt: -1 }).toArray()));
    const songs = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    return NextResponse.json({ configured: true, songs: songs.map((song) => ({
      id: song._id.toString(), title: song.title, artist: song.artist, category: song.category,
      duration: song.duration ?? "DJ mix", fileUrl: `/api/songs/${song.audioId.toString()}`,
    })) });
  } catch (error) {
    console.error("Unable to load songs", error);
    return NextResponse.json({ songs: [], configured: false, error: "MongoDB is not reachable yet." });
  }
}