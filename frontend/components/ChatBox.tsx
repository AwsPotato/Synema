"use client";

import React, { useEffect, useRef, useState } from "react";
import socket from "@/lib/socket";

interface ChatMessage {
  roomId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface ChatBoxProps {
  roomId: string;
  username: string;
}

// Generates a consistent styling color based on the username
function getUsernameColor(name: string) {
  const colors = [
    "text-indigo-400",
    "text-fuchsia-400",
    "text-pink-400",
    "text-emerald-400",
    "text-cyan-400",
    "text-amber-400",
    "text-sky-400",
    "text-violet-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatBox({ roomId, username }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Handler for incoming chat messages
    function handleChatMessage(message: ChatMessage) {
      setMessages((prev) => [...prev, message]);
    }

    socket.on("chat:message", handleChatMessage);

    return () => {
      socket.off("chat:message", handleChatMessage);
    };
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    // Send the chat message through socket
    socket.emit("chat:message", { roomId, username, text });
    setInputText("");
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-sm font-semibold tracking-tight text-zinc-200">
            Room Chat
          </span>
        </div>
        <span className="text-[10px] text-zinc-500 max-w-[150px] truncate">
          as: <span className="font-medium text-zinc-300">{username}</span>
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <svg
              className="w-8 h-8 text-zinc-600 mb-2 opacity-50"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
            <p className="text-xs text-zinc-500 font-medium">Welcome to the room!</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Send a message to start chatting.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelf = msg.username === username;
            return (
              <div
                key={index}
                className={`flex flex-col gap-0.5 text-sm hover:bg-white/[0.01] px-2 py-1.5 rounded-lg transition-colors duration-150 ${
                  isSelf ? "border-l border-indigo-500/20 bg-indigo-500/[0.01]" : ""
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className={`font-semibold text-xs tracking-tight ${getUsernameColor(msg.username)}`}>
                    {msg.username}
                  </span>
                  <span className="text-[9px] text-zinc-600">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="text-zinc-300 break-words leading-relaxed">{msg.text}</p>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-white/[0.06] p-3 bg-white/[0.01]"
      >
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-4 pr-10 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all duration-200"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-1.5 p-1.5 text-indigo-400 hover:text-indigo-300 disabled:text-zinc-700 transition-colors duration-200"
          >
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h5.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
