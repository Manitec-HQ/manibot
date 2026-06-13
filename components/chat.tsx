"use client";

import { defaultModel, modelID } from "@/ai/providers";
import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef } from "react";
import { Textarea } from "./textarea";
import { ProjectOverview } from "./project-overview";
import { Messages } from "./messages";
import { Header } from "./header";
import { toast } from "sonner";

interface ChatProps {
  sessionId: string;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export default function Chat({ sessionId, onToggleSidebar, sidebarOpen }: ChatProps) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<modelID>(defaultModel);
  const [loaded, setLoaded] = useState(false);
  const hasRestored = useRef(false);

  const { sendMessage, messages, setMessages, status, stop } = useChat({
    onError: (error) => {
      toast.error(
        error.message.length > 0
          ? error.message
          : "An error occured, please try again later.",
        { position: "top-center", richColors: true },
      );
    },
  });

  useEffect(() => {
    hasRestored.current = false;
    setMessages([]);
    setLoaded(false);
  }, [sessionId, setMessages]);

  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    fetch(`/api/messages?sessionId=${encodeURIComponent(sessionId)}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            parts: [{ type: "text" as const, text: m.content }],
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [sessionId, setMessages]);

  const isLoading = status === "streaming" || status === "submitted";

  const handleClearHistory = async () => {
    await fetch("/api/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sessionId }),
    });
    setMessages([]);
    toast.success("Chat history cleared.", { position: "top-center" });
  };

  if (!loaded) return null;

  return (
    <div className="flex flex-col w-full h-dvh">
      <Header
        onClearHistory={handleClearHistory}
        messages={messages}
        onToggleSidebar={onToggleSidebar}
        sidebarOpen={sidebarOpen}
      />
      <div className="flex-1 overflow-y-auto flex flex-col justify-center min-h-0">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto w-full px-4">
            <ProjectOverview />
          </div>
        ) : (
          <Messages messages={messages} isLoading={isLoading} status={status} />
        )}
      </div>
      <div className="shrink-0 bg-white dark:bg-black w-full pb-4 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage({ text: input }, { body: { selectedModel, sessionId } });
            setInput("");
          }}
          className="w-full max-w-xl mx-auto px-4 sm:px-0"
        >
          <Textarea
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            handleInputChange={(e) => setInput(e.currentTarget.value)}
            input={input}
            isLoading={isLoading}
            status={status}
            stop={stop}
          />
        </form>
      </div>
    </div>
  );
}
