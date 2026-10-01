"use client";

import { createContext, useContext } from "react";
import type { Messages } from "./en";

const MessagesContext = createContext<Messages | null>(null);

/** Makes the current locale's messages available to Client Components via useMessages(). */
export function MessagesProvider({ messages, children }: { messages: Messages; children: React.ReactNode }) {
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>;
}

export function useMessages(): Messages {
  const messages = useContext(MessagesContext);
  if (!messages) throw new Error("useMessages must be used inside <MessagesProvider>");
  return messages;
}
