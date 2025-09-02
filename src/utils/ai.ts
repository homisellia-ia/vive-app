import AIClass from "~/services/ai"
import { ChatMessage } from "../types/bot"
import { logError } from "./logger"

export async function safeAiChat(
  ai: AIClass,
  messages: ChatMessage[],
  fallback: string = "⚠️ Error al procesar la IA",
  model: string = ""
): Promise<string> {
  try {
    return await ai.createChat(messages, model)
  } catch (err) {
    logError("AI_ERROR", err)
    return fallback
  }
}
