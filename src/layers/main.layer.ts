// import { BotContext, BotMethods, BotState } from "~/types/bot"
import { globalFlags } from "~/core/globals"
import { flowSeller } from "~/flows/seller.flow"
import { flowSchedule } from "~/flows/schedule.flow"
import { flowConfirm } from "~/flows/confim.flow"
import { flowLuzIA } from "~/flows/luzia.flow"
import { getHistoryParse } from "../utils/handleHistory"
import { cancelReminders, scheduleReminders } from "~/utils/scheduleReminders"
// import { safeAiChat } from "~/utils/ai"
import { CLASSIFIER_PROMPT } from "~/prompts/classifier.prompt"
import { logInfo, logWarn } from "~/utils/logger"
import AIClass from "~/services/ai"
import { BotContext, BotMethods, BotState } from "@builderbot/bot/dist/types"

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

    // const prompt = CLASSIFIER_PROMPT(history)
    const prompt = `Eres un clasificador de conversaciones.  
    Analiza el historial y responde SOLO con la etiqueta del flujo correspondiente, sin explicaciones, sin observaciones, sin texto adicional.
    --------------------------------------------------------
    Historial de conversación:
    {HISTORY}
    
    Opciones posibles (elige SOLO UNA):
    1. luzia-flow: El usuario está interactuando con LuzIA para buscar propiedades, obtener informes y agendar una cita.

    -----------------------------
    Responde ÚNICAMENTE con: luzia-flow`.replace('{HISTORY}', history)


    // const text = await safeAiChat(ai, [{ role: "system", content: prompt }])
    let text = ""
    try {
        text = await ai.createChat([{ role: "system", content: prompt }])
    } catch (err) {
        console.error("Error en IA:", err)
    }

    // 1. luzia-flow: El usuario está interactuando con LuzIA para buscar propiedades, obtener informes y agendar una cita.

    const label = text.trim().toUpperCase()
    
    // logInfo("AI_RESPONSE", label)

    switch (label) {
        case "LUZIA-FLOW":
            // return gotoFlow(flowSeller)
            return gotoFlow(flowLuzIA)
        // case "AGENDAR":
            // return gotoFlow(flowSchedule)
        // case "CONFIRMAR":
        //     return gotoFlow(flowConfirm)
        default:
            logWarn("AI_CLASSIFIER", `Etiqueta inesperada: ${label}`)
            scheduleReminders(ctx, state, flowDynamic, endFlow)
            await flowDynamic("🤖 Estoy revisando tu mensaje, en breve te respondo...")
    }
}
