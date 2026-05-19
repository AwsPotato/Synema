"use client";

import React, { useEffect, useRef, useCallback, useState, Suspense } from "react";
import socket from "@/lib/socket";
import dynamic from "next/dynamic";

const RP = dynamic(() => import("react-player"), { ssr: false }) as any;

// ── URL type detection ────────────────────────────────────
function isDirectFileUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov|avi|mkv|mp3|wav|flac)(\?.*)?$/.test(pathname);
  } catch {
    return false;
  }
}

interface SyncPlayerProps {
  roomId: string;
  videoSrc: string;
}

export default function SyncPlayer({ roomId, videoSrc }: SyncPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rpRef = useRef<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const isDirect = isDirectFileUrl(videoSrc);

  // Player readiness tracking for ReactPlayer to prevent iframe seek stalls
  const isPlayerReady = useRef(false);
  const pendingSeekTime = useRef<number | null>(null);

  // HLS.js streaming levels and quality state
  const [hlsLevels, setHlsLevels] = useState<{ id: number; height: number; bitrate: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const hlsInstance = useRef<any>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);

  // Click outside to close quality menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(event.target as Node)) {
        setShowQualityMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset readiness and HLS state when video source changes
  useEffect(() => {
    isPlayerReady.current = false;
    setHlsLevels([]);
    setCurrentLevel(-1);
    setShowQualityMenu(false);
    hlsInstance.current = null;
  }, [videoSrc]);

  // ── Unified helpers to abstract over <video> vs ReactPlayer ──
  function getTime(): number {
    if (isDirect) return videoRef.current?.currentTime ?? 0;
    return rpRef.current?.getCurrentTime?.() ?? 0;
  }

  function seekTo(t: number) {
    if (isDirect) {
      if (videoRef.current) videoRef.current.currentTime = t;
    } else {
      if (isPlayerReady.current) {
        rpRef.current?.seekTo?.(t, "seconds");
      } else {
        pendingSeekTime.current = t;
      }
    }
  }

  function doPlay() {
    if (isDirect) {
      videoRef.current?.play().catch(() => {});
    } else {
      setRpPlaying(true);
    }
  }

  function doPause() {
    if (isDirect) {
      videoRef.current?.pause();
    } else {
      setRpPlaying(false);
    }
  }

  // ReactPlayer needs controlled playing state
  const [rpPlaying, setRpPlaying] = useState(false);

  // Flags to prevent socket echo loops
  const isExternalAction = useRef(false);
  const lastEmittedSeek = useRef(0);

  // ── Socket listeners (incoming from other peers) ────────
  useEffect(() => {
    function onRemotePlay(data?: { currentTime?: number }) {
      isExternalAction.current = true;
      if (data && typeof data.currentTime === "number") {
        if (Math.abs(getTime() - data.currentTime) > 1.5) {
          seekTo(data.currentTime);
        }
      }
      doPlay();
    }

    function onRemotePause(data?: { currentTime?: number }) {
      isExternalAction.current = true;
      if (data && typeof data.currentTime === "number") {
        if (Math.abs(getTime() - data.currentTime) > 1.5) {
          seekTo(data.currentTime);
        }
      }
      doPause();
    }

    function onRemoteSeek(data?: { currentTime?: number }) {
      if (data && typeof data.currentTime === "number") {
        isExternalAction.current = true;
        seekTo(data.currentTime);
      }
    }

    function onRoomState(state: {
      videoSrc: string;
      currentTime: number;
      isPlaying: boolean;
    }) {
      if (!state) return;
      isExternalAction.current = true;
      if (typeof state.currentTime === "number") {
        seekTo(state.currentTime);
      }
      if (state.isPlaying) {
        doPlay();
      } else {
        doPause();
      }
    }

    socket.on("video:play", onRemotePlay);
    socket.on("video:pause", onRemotePause);
    socket.on("video:seek", onRemoteSeek);
    socket.on("room:state", onRoomState);

    return () => {
      socket.off("video:play", onRemotePlay);
      socket.off("video:pause", onRemotePause);
      socket.off("video:seek", onRemoteSeek);
      socket.off("room:state", onRoomState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirect]);

  // ── Outgoing event handlers ─────────────────────────────
  const handlePlay = useCallback(() => {
    if (isExternalAction.current) {
      isExternalAction.current = false;
      return;
    }
    if (!roomId) return;
    socket.emit("video:play", { roomId, currentTime: getTime() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isDirect]);

  const handlePause = useCallback(() => {
    if (isExternalAction.current) {
      isExternalAction.current = false;
      return;
    }
    if (!roomId) return;
    socket.emit("video:pause", { roomId, currentTime: getTime() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isDirect]);

  const handleSeeked = useCallback(() => {
    if (isExternalAction.current) {
      isExternalAction.current = false;
      return;
    }
    if (!roomId) return;
    const now = getTime();
    if (Math.abs(now - lastEmittedSeek.current) < 0.5) return;
    lastEmittedSeek.current = now;
    socket.emit("video:seek", { roomId, currentTime: now });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isDirect]);

  // For ReactPlayer: detect seek via progress jumps
  const rpLastTime = useRef(0);
  const handleRpProgress = useCallback(
    (state: { playedSeconds: number }) => {
      const diff = Math.abs(state.playedSeconds - rpLastTime.current);
      if (diff > 2) {
        if (isExternalAction.current) {
          isExternalAction.current = false;
        } else if (roomId) {
          socket.emit("video:seek", { roomId, currentTime: state.playedSeconds });
        }
      }
      rpLastTime.current = state.playedSeconds;
    },
    [roomId]
  );

  const handleRpReady = useCallback(() => {
    isPlayerReady.current = true;
    if (pendingSeekTime.current !== null) {
      isExternalAction.current = true;
      rpRef.current?.seekTo?.(pendingSeekTime.current, "seconds");
      pendingSeekTime.current = null;
    }

    try {
      const internalPlayer = rpRef.current?.getInternalPlayer?.("hls");
      if (internalPlayer) {
        hlsInstance.current = internalPlayer;
        
        const updateLevels = () => {
          if (internalPlayer.levels && internalPlayer.levels.length > 0) {
            const levels = internalPlayer.levels.map((lvl: any, index: number) => ({
              id: index,
              height: lvl.height,
              bitrate: lvl.bitrate,
            }));
            setHlsLevels(levels);
            setCurrentLevel(internalPlayer.currentLevel);
          }
        };

        updateLevels();

        // Listen for levels loaded / parsed
        internalPlayer.on("manifestParsed", updateLevels);
      }
    } catch (e) {
      console.error("HLS quality detection error:", e);
    }
  }, []);

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(99,102,241,0.15)] ring-1 ring-white/5 bg-black">
      {/* Ambient glow behind the player */}
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10 blur-2xl" />

      {/* Floating HLS quality menu */}
      {hlsLevels.length > 0 && (
        <div ref={qualityMenuRef} className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setShowQualityMenu(!showQualityMenu)}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/60 hover:bg-black/80 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-lg cursor-pointer transition-colors"
          >
            <svg
              className="w-3.5 h-3.5 text-indigo-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>
              {currentLevel === -1
                ? "Auto"
                : `${hlsLevels.find((l) => l.id === currentLevel)?.height}p` || "Quality"}
            </span>
          </button>

          {showQualityMenu && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border border-white/[0.08] bg-black/85 backdrop-blur-lg p-1 shadow-2xl animate-fade-in">
              <button
                onClick={() => {
                  setCurrentLevel(-1);
                  if (hlsInstance.current) hlsInstance.current.currentLevel = -1;
                  setShowQualityMenu(false);
                }}
                className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                  currentLevel === -1
                    ? "bg-indigo-500/20 text-indigo-400 font-semibold"
                    : "text-zinc-300 hover:bg-white/[0.05]"
                }`}
              >
                Auto (Default)
              </button>
              {hlsLevels.map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => {
                    setCurrentLevel(lvl.id);
                    if (hlsInstance.current) hlsInstance.current.currentLevel = lvl.id;
                    setShowQualityMenu(false);
                  }}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                    currentLevel === lvl.id
                      ? "bg-indigo-500/20 text-indigo-400 font-semibold"
                      : "text-zinc-300 hover:bg-white/[0.05]"
                  }`}
                >
                  {lvl.height}p ({Math.round(lvl.bitrate / 100000) / 10} Mbps)
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isDirect ? (
        /* ── Native <video> for direct file URLs ── */
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          controls
          preload="auto"
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeeked}
          className="relative z-10 w-full h-full object-contain bg-black"
        />
      ) : (
        /* ── ReactPlayer for YouTube, Twitch, Vimeo, etc. ── */
        isMounted && (
          <div className="absolute inset-0 z-10 w-full h-full">
            <RP
              key={videoSrc}
              ref={rpRef}
              url={videoSrc}
              controls
              playing={rpPlaying}
              width="100%"
              height="100%"
              onReady={handleRpReady}
              onPlay={handlePlay}
              onPause={handlePause}
              onProgress={handleRpProgress}
            />
          </div>
        )
      )}
    </div>
  );
}
