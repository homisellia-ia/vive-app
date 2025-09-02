import { BotState, ChatMessage } from "../types/bot"

/**
 * Estructura interna que guardamos en state.history
 */
type StoredEntry = ChatMessage & {
  timestamp: number;
};

/**
 * Agrega una entrada al historial guardado en state.
 * Mantiene el historial en orden cronológico (push al final).
 */
export async function handleHistory(entry: ChatMessage, state: BotState): Promise<void> {
  const prev = (state.get<StoredEntry[]>("history") ?? []) as StoredEntry[];
  const newEntry: StoredEntry = {
    role: entry.role,
    content: entry.content,
    timestamp: Date.now(),
  };

  const next = [...prev, newEntry];

  // Si el historial crece mucho, recortamos dejando las últimas 100 entradas.
  const MAX_ENTRIES = 100;
  const trimmed = next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;

  await state.update({ history: trimmed });
}

/**
 * Devuelve el historial como array de ChatMessage (role + content),
 * en orden cronológico (primer elemento = primer mensaje).
 */
export function getHistoryMessages(state: BotState): ChatMessage[] {
  const prev = (state.get<StoredEntry[]>("history") ?? []) as StoredEntry[];
  return prev.map(({ role, content }) => ({ role, content }));
}

/**
 * Genera una cadena formateada del historial para inyectar dentro de un prompt tipo {HISTORY}.
 * - Por defecto devuelve las últimas `maxMessages` entradas (cronológico).
 * - También acota el resultado a `maxChars` caracteres (manteniendo el final del historial).
 *
 * Útil para prompts antiguos que recibían un HISTORY concatenado (string).
 */
export function getHistoryParse(
  state: BotState,
  opts?: { maxMessages?: number; maxChars?: number }
): string {
  const { maxMessages = 30, maxChars = 3000 } = opts ?? {};
  const msgs = getHistoryMessages(state);
  const sliceStart = Math.max(0, msgs.length - maxMessages);
  const recent = msgs.slice(sliceStart);

  const roleLabel = (role: string) => {
    if (role === "user") return "Usuario";
    if (role === "assistant") return "Asistente";
    return role;
  };

  // Normalizamos espacios y nuevas líneas para evitar prompts muy ruidosos.
  const lines = recent.map((m) => {
    const text = String(m.content ?? "").replace(/\s+/g, " ").trim();
    return `${roleLabel(m.role)}: ${text}`;
  });

  let joined = lines.join("\n");
  if (joined.length > maxChars) {
    // conservamos el final del historial (contexto más reciente)
    joined = joined.slice(joined.length - maxChars);
    // aseguramos no empezar en mitad de una palabra
    const firstNewline = joined.indexOf("\n");
    if (firstNewline > 0) {
      joined = joined.slice(firstNewline + 1);
    }
  }

  return joined
}

/**
 * Devuelve el historial ya preparado como mensajes del LLM:
 * [{ role: 'user'|'assistant'|'system', content: '...' }, ...]
 *
 * Útil cuando quieres enviar directamente `messages` a `ai.createChat(messages)`.
 */
export function getHistoryAsLLMMessages(state: BotState): ChatMessage[] {
  return getHistoryMessages(state)
}

/**
 * Vacía el historial guardado en state.
 */
export async function clearHistory(state: BotState): Promise<void> {
  await state.update({ history: [] })
}
