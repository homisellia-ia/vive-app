// import { BotContext, BotMethods, BotState } from "~/types/bot"
import { globalFlags } from "~/core/globals"
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
    const prompt = CLASSIFIER_PROMPT(history)

    // const text = await safeAiChat(ai, [{ role: "system", content: prompt }])
    let text = ""
    try {
        text = await ai.createChat([{ role: "system", content: prompt }])
    } catch (err) {
        console.error("Error en IA:", err)
    }

    const label = text.trim().toUpperCase()
    
    // logInfo("AI_RESPONSE", label)

    switch (label) {
        case "LUZIA-FLOW":
            return gotoFlow(flowLuzIA)
        default:
            logWarn("AI_CLASSIFIER", `Etiqueta inesperada: ${label}`)
            scheduleReminders(ctx, state, flowDynamic, endFlow)
            await flowDynamic("🤖 Estoy revisando tu mensaje, en breve te respondo...")
    }
}
