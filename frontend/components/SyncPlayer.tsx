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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset readiness state when video source changes
  useEffect(() => {
    isPlayerReady.current = false;
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
  }, []);

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="relative w-full max-w-5xl mx-auto aspect-video rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(99,102,241,0.15)] ring-1 ring-white/5 bg-black">
      {/* Ambient glow behind the player */}
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10 blur-2xl" />

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
