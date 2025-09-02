import { clearHistory, handleHistory, getHistoryParse } from "../utils/handleHistory"
import { getFullCurrentDate } from "../utils/currentDate"
import { appToCalendar } from "src/services/calendar"
import { addKeyword, EVENTS } from "@builderbot/bot"
import { BotState } from "~/types/bot"
import { safeAiChat } from "~/utils/ai"
import AIClass from "~/services/ai"

const generatePromptToFormatDate = (history: string) => {
    const prompt = `Fecha de Hoy:${getFullCurrentDate()}, Basado en el Historial de conversacion: 
    ${history}
    ----------------
    Fecha ideal:...dd / mm hh:mm`

    return prompt
}

const generateJsonParse = (info: string) => {
    const prompt = `tu tarea principal es analizar la información proporcionada en el contexto y generar un objeto JSON que se adhiera a la estructura especificada a continuación. 

    Contexto: "${info}"
    
    {
        "name": "Leifer",
        "interest": "n/a",
        "value": "0",
        "email": "fef@fef.com",
        "startDate": "2024/02/15 00:00:00"
    }
    
    Objeto JSON a generar:`

    return prompt
}

export const flowConfirm = addKeyword(EVENTS.ACTION).addAction(async (_, { flowDynamic }) => {
    await flowDynamic('Ok, voy a pedirte unos datos para agendar')
    await flowDynamic('¿Cual es tu nombre?')
}).addAction({ capture: true }, async (ctx, { state, flowDynamic, extensions }) => {
    await state.update({ name: ctx.body })
    const ai = extensions.ai as AIClass
    const history = getHistoryParse(state as BotState)

    const text = await safeAiChat(ai, [{ role: "system", content: generatePromptToFormatDate(history) }])

    await handleHistory({ content: text, role: 'assistant' }, state as BotState)
    await flowDynamic(`¿Me confirmas fecha y hora?: ${text}`)
    await state.update({ startDate: text })
})
.addAction({ capture: true }, async (ctx, { state, flowDynamic }) => {
    await flowDynamic(`Ultima pregunta ¿Cual es tu email?`)
})
.addAction({ capture: true }, async (ctx, { state, extensions, flowDynamic }) => {
    const infoCustomer = `Name: ${state.get('name')}, StarteDate: ${state.get('startDate')}, email: ${ctx.body}`
    const ai = extensions.ai as AIClass

    const text = await safeAiChat(ai, [{ role: "system", content: generateJsonParse(infoCustomer) }])

    await appToCalendar(text)
    // await state.update({ finished: true })
    clearHistory(state as BotState)
    await flowDynamic("¡Genial! Recibirás el informe detallado y la confirmación de la visita en tu correo. ¿Hay algo más en lo que pueda ayudarte hoy? 😊")
})