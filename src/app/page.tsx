"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Disc3, FolderOpen, Headphones, Heart, LoaderCircle, Pause, Play, Search, SkipBack, SkipForward, Trash2, Upload, Volume2, X } from "lucide-react";

type Song = { id: string; title: string; artist: string; category: string; duration: string; fileUrl?: string };

const demoSongs: Song[] = [
  { id: "demo-1", title: "Vinayaka Dj Sharanam", artist: "Nadam Originals", category: "Devotional", duration: "06:24" },
  { id: "demo-2", title: "Ganapathi Bappa Bass Mix", artist: "DJ Sree", category: "Bass Boost", duration: "04:48" },
  { id: "demo-3", title: "Vighnaharta Street Edit", artist: "Nadam Originals", category: "Procession", duration: "05:16" },
  { id: "demo-5", title: "Lalbagh Cha Raja Dhol", artist: "Beat Mandali", category: "Procession", duration: "03:55" },
  { id: "demo-6", title: "Pandal Lights Afterdark", artist: "DJ Sree", category: "Bass Boost", duration: "05:32" },
];

const defaultFolders = ["Devotional", "Bass Boost", "Procession", "Love Failure", "Youth", "Pavankalyan"];
const likedFolder = "Liked songs";

export default function Home() {
  const [songs, setSongs] = useState<Song[]>(() => {
    if (typeof window === "undefined") return demoSongs;
    try {
      const savedSongs = window.localStorage.getItem("challenging-youth-songs");
      return savedSongs ? JSON.parse(savedSongs) as Song[] : demoSongs;
    } catch {
      return demoSongs;
    }
  });
  const [activeSong, setActiveSong] = useState<Song | null>(demoSongs[0]);
  const [category, setCategory] = useState("All mixes");
  const [query, setQuery] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [likedSongIds, setLikedSongIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const savedLikes = window.localStorage.getItem("challenging-youth-liked-songs");
      return savedLikes ? JSON.parse(savedLikes) as string[] : [];
    } catch {
      return [];
    }
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(defaultFolders[0]);
  const [newFolder, setNewFolder] = useState("");
  const [uploadState, setUploadState] = useState("Ready for an audio file.");
  const [cacheState, setCacheState] = useState("Preparing your library...");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    fetch("/songs.json").then((response) => response.ok ? response.json() : []).then((localSongs) => {
      if (localSongs.length) {
        setSongs(localSongs);
        window.localStorage.setItem("challenging-youth-songs", JSON.stringify(localSongs));
      }
    }).catch(() => undefined);
    fetch("/api/songs").then((response) => response.json()).then((data) => {
      if (data.songs?.length) {
        setSongs(data.songs);
        window.localStorage.setItem("challenging-youth-songs", JSON.stringify(data.songs));
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.active?.postMessage({ type: "CACHE_SONGS", urls: data.songs.map((song: Song) => song.fileUrl).filter(Boolean), priorityUrl: data.songs[0]?.fileUrl });
            setCacheState(`${data.songs.length} songs are being prepared for quick playback.`);
          }).catch(() => setCacheState("Songs will stream from the internet."));
        }
      }
    }).catch(() => setCacheState("Ready to play from the saved library."));
  }, []);

  useEffect(() => {
    if (!songs.length) return;
    const initialSong = songs[0];
    setActiveSong((current) => current ?? initialSong);
    if (audioRef.current && initialSong.fileUrl) {
      audioRef.current.src = initialSong.fileUrl;
      audioRef.current.preload = "auto";
      audioRef.current.load();
    }

    const prefetchCount = Math.min(songs.length, 6);
    songs.slice(0, prefetchCount).forEach((song) => {
      if (!song.fileUrl) return;
      const audio = new Audio(song.fileUrl);
      audio.preload = "auto";
      audio.load();
    });
  }, [songs]);

  useEffect(() => {
    window.localStorage.setItem("challenging-youth-liked-songs", JSON.stringify(likedSongIds));
  }, [likedSongIds]);

  const folders = useMemo(() => [likedFolder, ...new Set([...defaultFolders, ...songs.map((song) => song.category).filter(Boolean)])], [songs]);

  const folderCounts = useMemo(() => folders.reduce<Record<string, number>>((counts, folder) => {
    const total = folder === likedFolder
      ? songs.filter((song) => likedSongIds.includes(song.id)).length
      : songs.filter((song) => song.category === folder).length;
    counts[folder] = folder === "Love Failure" ? Math.min(total, 3) : total;
    return counts;
  }, {}), [folders, likedSongIds, songs]);

  const filteredSongs = useMemo(() => {
    const baseSongs = songs.filter((song) => {
      const matchesCategory = category === "All mixes"
        || (category === likedFolder ? likedSongIds.includes(song.id) : song.category === category);
      const matchesQuery = `${song.title} ${song.artist}`.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });

    if (category === "Love Failure") {
      return baseSongs.slice(0, 3);
    }

    return baseSongs;
  }, [songs, category, likedSongIds, query]);

  function chooseSong(song: Song) {
    setActiveSong(song);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    if (song.fileUrl && audioRef.current) {
      audioRef.current.src = song.fileUrl;
      audioRef.current.preload = "auto";
      audioRef.current.load();
      void audioRef.current.play();
    }
  }

  function togglePlayback() {
    if (!activeSong) return;
    if (activeSong.fileUrl && audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else void audioRef.current.play();
    }
    setIsPlaying((current) => !current);
  }

  function seekSong(value: number) {
    setCurrentTime(value);
    if (audioRef.current) audioRef.current.currentTime = value;
  }

  function playPreviousSong() {
    if (!activeSong || !filteredSongs.length) return;
    const currentIndex = filteredSongs.findIndex((song) => song.id === activeSong.id);
    const previousSong = filteredSongs[(currentIndex - 1 + filteredSongs.length) % filteredSongs.length];
    if (previousSong) chooseSong(previousSong);
  }

  function playNextSong() {
    if (!activeSong || !filteredSongs.length) return;
    const currentIndex = filteredSongs.findIndex((song) => song.id === activeSong.id);
    const nextSong = filteredSongs[(currentIndex + 1) % filteredSongs.length];
    if (nextSong) chooseSong(nextSong);
  }

  function formatTime(value: number) {
    if (!Number.isFinite(value)) return "00:00";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function toggleLike() {
    if (!activeSong) return;
    setLikedSongIds((current) => current.includes(activeSong.id)
      ? current.filter((songId) => songId !== activeSong.id)
      : [...current, activeSong.id]);
  }

  async function uploadSong(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadState("Uploading and filing your song...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", newFolder.trim() || selectedFolder);
    try {
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setUploadState(`${result.uploaded} song${result.uploaded === 1 ? "" : "s"} added. Refreshing your library...`);
      const songsResponse = await fetch("/api/songs");
      const songsData = await songsResponse.json();
      if (songsData.songs?.length) setSongs(songsData.songs);
      setNewFolder("");
      setShowUpload(false);
    } catch (error) {
      setUploadState(error instanceof Error ? error.message : "Upload failed. Check your MongoDB connection.");
    }
  }

  async function deleteSong(song: Song) {
    if (!song.id || !song.id.match(/^[a-f\d]{24}$/i) || !window.confirm(`Delete "${song.title}" from the library?`)) return;
    try {
      const response = await fetch(`/api/songs/${song.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (activeSong?.id === song.id) {
        audioRef.current?.pause();
        setActiveSong(null);
        setIsPlaying(false);
      }
      setSongs((current) => current.filter((item) => item.id !== song.id));
      setLikedSongIds((current) => current.filter((songId) => songId !== song.id));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Delete failed. Check your MongoDB connection.");
    }
  }

  return (
    <main className="min-h-screen pb-32">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3"><div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#e66f2e] text-white shadow-lg shadow-orange-200"><Disc3 size={21} /><Image src="/logo.jpeg" alt="Challenging Youth logo" width={56} height={56} className="absolute inset-0 h-full w-full object-cover" /></div><span className="display-font text-xl font-bold tracking-tight">Challenging Youth<span className="text-[#e66f2e]">.</span></span></div>
        <div className="hidden items-center gap-8 text-sm font-semibold text-[#68736c] md:flex"><a className="text-[#17221c]" href="#library">Library</a><a href="#about">About the collection</a></div>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 rounded-full border border-[#d9d4c9] bg-[#fffdf8] px-4 py-2.5 text-sm font-bold transition hover:border-[#e66f2e] hover:text-[#e66f2e]"><Upload size={16} /> Add songs</button>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:pt-16">
        <div className="flex flex-col justify-center"><p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#e66f2e]"><span className="h-2 w-2 rounded-full bg-[#e66f2e]" /> Festival season 2026</p><h1 className="display-font max-w-2xl text-5xl font-bold leading-[1.02] tracking-[-0.045em] text-[#17221c] sm:text-7xl">Turn it up for <span className="text-[#e66f2e]">Vinayaka.</span></h1><p className="mt-7 max-w-lg text-lg leading-8 text-[#68736c]">Your home for the loudest dhols, warmest chants, and late-night DJ edits of Chavithi.</p><div className="mt-9 flex flex-wrap items-center gap-4"><a href="#library" className="rounded-full bg-[#17221c] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#2f6849]">Explore the mixes</a><span className="text-sm font-semibold text-[#68736c]">{songs.length} tracks in the archive</span></div></div>
        <div className="grain relative min-h-[330px] overflow-hidden rounded-[2rem] bg-[#2f6849] p-8 text-white shadow-2xl shadow-[#2f6849]/20 sm:min-h-[390px]"><div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[35px] border-[#f5bd6d]/70" /><div className="absolute -bottom-32 -left-16 h-64 w-64 rounded-full border-[28px] border-[#e66f2e]/90" /><div className="relative flex h-full flex-col justify-between"><div className="flex items-start justify-between"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">Nadam sessions / 01</span><Volume2 size={22} /></div><div><p className="mb-3 text-sm font-semibold text-[#f5bd6d]">NOW PLAYING</p><h2 className="display-font max-w-sm text-4xl font-bold leading-tight">{activeSong?.title ?? "Choose a mix"}</h2><p className="mt-3 text-sm text-white/70">{activeSong?.artist ?? "Your collection"}</p><div className="mt-7"><input aria-label="Seek through current song" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seekSong(Number(event.target.value))} disabled={!duration} className="h-1.5 w-full cursor-pointer accent-[#f5bd6d] disabled:cursor-not-allowed disabled:opacity-50" /><div className="mt-2 flex justify-between text-xs font-semibold text-white/65"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div><div className="mt-4 flex items-center gap-3"><button aria-label="Play previous song" title="Previous song" onClick={playPreviousSong} disabled={!activeSong || !filteredSongs.length} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white transition hover:scale-105 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"><SkipBack size={18} /></button><button aria-label={isPlaying ? "Pause current song" : "Play current song"} onClick={togglePlayback} className="grid h-14 w-14 place-items-center rounded-full bg-[#f5bd6d] text-[#17221c] transition hover:scale-105">{isPlaying ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} />}</button><button aria-label="Play next song" title="Next song" onClick={playNextSong} disabled={!activeSong || !filteredSongs.length} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white transition hover:scale-105 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"><SkipForward size={18} /></button><button aria-label={activeSong && likedSongIds.includes(activeSong.id) ? "Unlike current song" : "Like current song"} onClick={toggleLike} disabled={!activeSong} className="grid h-12 w-12 place-items-center rounded-full border border-white/35 text-white transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"> <Heart size={20} fill={activeSong && likedSongIds.includes(activeSong.id) ? "currentColor" : "none"} /></button></div></div></div></div>
      </section>

      <section id="library" className="mx-auto max-w-7xl px-6 lg:px-10"><div className="flex flex-col justify-between gap-6 border-b border-[#e6e1d7] pb-7 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#e66f2e]">The archive</p><h2 className="display-font text-3xl font-bold tracking-tight sm:text-4xl">Pick your energy.</h2></div><label className="flex w-full items-center gap-3 rounded-full border border-[#e6e1d7] bg-[#fffdf8] px-4 py-3 text-sm text-[#68736c] md:max-w-xs"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mixes" className="w-full bg-transparent outline-none placeholder:text-[#9ba39e]" /></label></div>
        <div className="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {["All mixes", ...folders].map((item) => {
            const isActive = category === item;
            const count = item === "All mixes" ? songs.length : folderCounts[item] ?? 0;
            return <button key={item} onClick={() => setCategory(item)} aria-pressed={isActive} className={`group flex min-h-24 items-center justify-between rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${isActive ? "border-[#e66f2e] bg-[#fff0e8] text-[#17221c] shadow-lg shadow-[#e4d7ba]/35" : "border-[#e6e1d7] bg-[#fffdf8]/75 text-[#68736c] hover:border-[#f5bd6d] hover:bg-[#fff8ee]"}`}><span className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${isActive ? "bg-[#e66f2e] text-white" : "bg-[#ece9e0] text-[#68736c]"}`}><FolderOpen size={19} /></span><span><span className="block font-bold">{item}</span><span className={`mt-1 block text-xs ${isActive ? "text-[#c84c22]" : "text-[#9ba39e]"}`}>{count} {count === 1 ? "song" : "songs"}</span></span></span>{isActive && <span className="rounded-full bg-[#17221c] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">Open</span>}</button>;
          })}
        </div>
        <div className="mb-6 flex items-center justify-between gap-4"><p className="text-sm font-semibold text-[#68736c]">{category === "All mixes" ? "All songs" : `${category} folder`}</p><span className="text-xs font-semibold text-[#9ba39e]">{cacheState}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filteredSongs.map((song, index) => <article key={song.id} onClick={() => chooseSong(song)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") chooseSong(song); }} role="button" tabIndex={0} className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-[#e6e1d7] bg-[#fffdf8]/75 p-4 transition hover:-translate-y-1 hover:border-[#f5bd6d] hover:shadow-xl hover:shadow-[#e4d7ba]/40"><button onClick={() => chooseSong(song)} aria-label={`Play ${song.title}`} className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl text-white ${index % 3 === 0 ? "bg-[#e66f2e]" : index % 3 === 1 ? "bg-[#2f6849]" : "bg-[#17221c]"}`}>{activeSong?.id === song.id && isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><div className="min-w-0 flex-1"><p className="truncate font-bold text-[#17221c]">{song.title}</p><p className="mt-1 truncate text-sm text-[#68736c]">{song.artist}</p></div><span className="text-xs font-semibold text-[#9ba39e]">{song.duration}</span>{song.id.match(/^[a-f\d]{24}$/i) && <button onClick={(event) => { event.stopPropagation(); void deleteSong(song); }} aria-label={`Delete ${song.title}`} title="Delete song" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#9ba39e] transition hover:bg-[#fff0e8] hover:text-[#c84c22]"><Trash2 size={16} /></button>}</article>)}</div>
        {!filteredSongs.length && <div className="rounded-2xl border border-dashed border-[#d9d4c9] p-12 text-center text-[#68736c]">No mixes match that search yet.</div>}
      </section>

      <section id="about" className="mx-auto mt-24 grid max-w-7xl gap-8 border-t border-[#e6e1d7] px-6 pt-10 md:grid-cols-[1fr_auto] lg:px-10"><div><p className="display-font text-2xl font-bold">Made for the whole pandal.</p><p className="mt-2 max-w-xl leading-7 text-[#68736c]">Keep every procession anthem, family favorite, and midnight bass edit in one place. Add songs one file at a time and let the archive grow.</p></div><div className="flex items-start gap-3 text-sm font-semibold text-[#68736c]"><Headphones size={19} className="text-[#e66f2e]" /> Built for big speakers and small screens.</div></section>

      <div className="fixed bottom-8 right-8 z-10 flex items-center gap-3"><button aria-label="Play previous song" title="Previous song" onClick={playPreviousSong} disabled={!activeSong || !filteredSongs.length} className="grid h-11 w-11 place-items-center rounded-full bg-[#17221c] text-white shadow-xl transition hover:scale-105 hover:bg-[#2f6849] disabled:cursor-not-allowed disabled:opacity-40"><SkipBack size={17} fill="currentColor" /></button><button aria-label="Play next song" title="Next song" onClick={playNextSong} disabled={!activeSong || !filteredSongs.length} className="grid h-11 w-11 place-items-center rounded-full bg-[#17221c] text-white shadow-xl transition hover:scale-105 hover:bg-[#2f6849] disabled:cursor-not-allowed disabled:opacity-40"><SkipForward size={17} fill="currentColor" /></button></div>
      <audio ref={audioRef} preload="auto" onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)} onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)} onEnded={playNextSong} />
      {showUpload && <div className="fixed inset-0 z-20 grid place-items-center bg-[#17221c]/45 p-5" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-[1.75rem] bg-[#fffdf8] p-7 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e66f2e]">Library admin</p><h2 className="display-font mt-2 text-3xl font-bold">Add songs.</h2></div><button onClick={() => setShowUpload(false)} aria-label="Close upload dialog" className="rounded-full p-2 text-[#68736c] hover:bg-[#ece9e0]"><X size={20} /></button></div><p className="mt-4 text-sm leading-6 text-[#68736c]">Choose an audio file or ZIP archive, then select the folder where it should appear.</p><label className="mt-5 block text-sm font-bold text-[#17221c]">Save in folder<select value={selectedFolder} onChange={(event) => setSelectedFolder(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d9d4c9] bg-white px-3 py-3 font-normal outline-none focus:border-[#e66f2e]">{folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select></label><label className="mt-4 block text-sm font-bold text-[#17221c]">Or create a new folder<input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder="Folder name" className="mt-2 w-full rounded-xl border border-[#d9d4c9] bg-white px-3 py-3 font-normal outline-none placeholder:text-[#9ba39e] focus:border-[#e66f2e]" /></label><label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d9d4c9] p-8 text-center transition hover:border-[#e66f2e] hover:bg-[#fff8ee]"><Upload size={26} className="text-[#e66f2e]" /><span className="mt-3 font-bold">Choose audio or ZIP</span><span className="mt-1 text-xs text-[#9ba39e]">MP3, WAV, M4A, OGG, AAC, or ZIP</span><input type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/aac,.mp3,.wav,.m4a,.ogg,.aac,.zip,application/zip" onChange={uploadSong} className="hidden" /></label><div className="mt-5 flex items-center gap-2 text-sm text-[#68736c]">{uploadState.includes("...") && <LoaderCircle size={16} className="animate-spin text-[#e66f2e]" />}{uploadState}</div></div></div>}
    </main>
  );
}
