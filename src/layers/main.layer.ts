import { BotContext, BotMethods, BotState } from "@builderbot/bot/dist/types"
import { getHistoryParse } from "../utils/handleHistory"
import AIClass from "~/services/ai"
import { cancelReminders, scheduleReminders } from "~/utils/scheduleReminders"
import { globalFlags } from "~/core/globals"
import { flowLuzIA } from "~/flows/luzia.flow"

export default async (ctx: BotContext, { state, gotoFlow, extensions, flowDynamic, endFlow }: BotMethods) => {
    if (state.get('finished')) return

    if (globalFlags.agentMessageReceived) {
        // console.log("⛔ Chat bloqueado porque ya respondió un agente")
        cancelReminders(ctx.from, state)
        await state.update({ finished: true })
        return
    }

    await state.update({ lastUserAt: Date.now() })
    cancelReminders(ctx.from, state)

    const ai = extensions.ai as AIClass
    const history = getHistoryParse(state as BotState)

    const prompt = `Eres un clasificador de conversaciones.  
    Analiza el historial y responde SOLO con la etiqueta del flujo correspondiente, sin explicaciones, sin observaciones, sin texto adicional.
    --------------------------------------------------------
    Historial de conversación:
    {HISTORY}
    
    Opciones posibles (elige SOLO UNA):
    1. luzia-flow: El usuario está interactuando con LuzIA para buscar propiedades, obtener informes y agendar una cita.

    -----------------------------
    Responde ÚNICAMENTE con: luzia-flow`.replace('{HISTORY}', history)

    let text = ""
    try {
        text = await ai.createChat([{ role: "system", content: prompt }])
    } catch (err) {
        console.error("Error en IA:", err)
    }

    // console.log("Respuesta IA:", text)

    if (text.includes('luzia-flow')) return gotoFlow(flowLuzIA)

    scheduleReminders(ctx, state, flowDynamic, endFlow)
    await flowDynamic("🤖 Estoy revisando tu mensaje, en breve te respondo...")
}
