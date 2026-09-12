import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const database = await getDatabase();
    if (!database) return NextResponse.json({ songs: [], configured: false });
    const songs = await database.collection("songs").find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ configured: true, songs: songs.map((song) => ({
      id: song._id.toString(), title: song.title, artist: song.artist, category: song.category,
      duration: song.duration ?? "DJ mix", fileUrl: `/api/songs/${song.audioId.toString()}`,
    })) });
  } catch (error) {
    console.error("Unable to load songs", error);
    return NextResponse.json({ songs: [], configured: false, error: "MongoDB is not reachable yet." });
  }
}