"use client";

import { useEffect, useState, useCallback } from "react";
import socket from "@/lib/socket";
import SyncPlayer from "@/components/SyncPlayer";

// ─── Icons (inline SVGs to avoid extra deps) ────────────────
function FilmIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
      <line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SignalIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
      <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
    </svg>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function Home() {
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [connected, setConnected] = useState(false);
  const [videoSrc, setVideoSrc] = useState("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");

  // Connect the singleton socket once on mount
  useEffect(() => {
    if (!socket.connected) socket.connect();

    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }

    function onRoomState(state: { videoSrc: string }) {
      if (state && state.videoSrc) {
        setVideoSrc(state.videoSrc);
      }
    }

    function onVideoSource(data: { source: string }) {
      if (data && data.source) {
        setVideoSrc(data.source);
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onRoomState);
    socket.on("video:source", onVideoSource);

    // If already connected (reconnect / HMR)
    if (socket.connected) setConnected(true);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", onRoomState);
      socket.off("video:source", onVideoSource);
    };
  }, []);

  const handleJoin = useCallback(() => {
    const trimmed = room.trim();
    if (!trimmed) return;
    socket.emit("joinRoom", { roomId: trimmed });
    setJoined(true);
  }, [room]);

  const handleVideoSrcChange = useCallback((newSrc: string) => {
    setVideoSrc(newSrc);
    if (joined && room) {
      socket.emit("video:source", { roomId: room, source: newSrc });
    }
  }, [joined, room]);

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-[#08080c] text-zinc-100 selection:bg-indigo-500/30 font-sans">
      {/* ─── Ambient Background ───────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 h-[120vh] w-[80vw] rounded-full bg-indigo-950/20 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 h-[100vh] w-[70vw] rounded-full bg-fuchsia-950/15 blur-[140px]" />
      </div>

      {/* ─── Header ───────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-white/5 backdrop-blur-sm bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/20">
            <FilmIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Synema
          </span>
        </div>

        {/* Connection indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                : "bg-zinc-600"
            } transition-colors duration-300`}
          />
          <span className="text-zinc-500">
            {connected ? "Connected" : "Offline"}
          </span>
        </div>
      </header>

      {/* ─── Content ──────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-6 py-12">
        {/* Join Room Card */}
        {!joined && (
          <div className="w-full max-w-md animate-fade-in">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
              <div className="flex items-center gap-3 mb-6">
                <UsersIcon className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-medium text-zinc-200">
                  Join a Watch Party
                </h2>
              </div>

              <p className="text-sm text-zinc-500 mb-5 leading-relaxed">
                Enter a room code to sync playback with friends in real time.
              </p>

              <div className="flex gap-3">
                <input
                  id="room-input"
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="e.g. movie-night-42"
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                />
                <button
                  id="join-btn"
                  onClick={handleJoin}
                  disabled={!room.trim()}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.97]"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Room & Video Controls */}
        {joined && (
          <div className="flex flex-col items-center gap-4 w-full max-w-xl animate-fade-in">
            <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-xs text-zinc-400 backdrop-blur-sm">
              <SignalIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Room: <span className="text-zinc-200 font-medium">{room}</span>
              </span>
            </div>

            <div className="w-full flex gap-2 items-center rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <span className="text-xs text-zinc-500 whitespace-nowrap px-1">Video Source:</span>
              <input
                id="video-url-input"
                type="text"
                value={videoSrc}
                onChange={(e) => handleVideoSrcChange(e.target.value)}
                placeholder="Paste any direct video MP4/WebM URL here"
                className="flex-1 bg-transparent text-xs text-indigo-300 placeholder:text-zinc-700 outline-none"
              />
            </div>
          </div>
        )}

        {/* Video Player */}
        <div className={`w-full transition-all duration-700 ${joined ? "opacity-100 translate-y-0" : "opacity-30 translate-y-2 pointer-events-none blur-[2px]"}`}>
          <SyncPlayer roomId={room} videoSrc={videoSrc} />
        </div>

        {/* Footer hint */}
        <p className="text-[11px] text-zinc-600 tracking-wide">
          {joined
            ? "Playback is synced across all peers in this room."
            : "Join a room to enable synchronised playback."}
        </p>
      </main>
    </div>
  );
}
