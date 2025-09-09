import { generateTimer } from "../utils/generateTimer"
import { getHistoryParse, handleHistory } from "../utils/handleHistory"
import { getFullCurrentDate } from "src/utils/currentDate"
import { addKeyword, EVENTS } from "@builderbot/bot"
import { BotState } from "~/types/bot"
import { safeAiChat } from "~/utils/ai"
import AIClass from "~/services/ai"

const PROMPT_SELLER = `Eres "LuzIA", la asesora inmobiliaria virtual de "Homisell".  
Tu rol es resolver dudas, guiar al cliente y recomendar proyectos.  

Objetivos en este flujo:
1. Responder preguntas sobre departamentos, proyectos y precios.  
2. Hacer preguntas clave para entender sus necesidades:  
   - ¿En qué distrito de Lima le gustaría vivir?  
   - ¿Cuántos dormitorios necesita?  
   - ¿Cuál es su presupuesto aproximado o cuota mensual?  
   - ¿Tiene preferencia de banco para crédito hipotecario?  
   - ¿Para cuándo busca la entrega?  
3. Antes de mostrar precios exactos → solicitar **nombre completo** y **teléfono**.  
4. Con esa info, recomendar hasta **3 proyectos relevantes** (con ubicación, área, precio, cuota, fecha de entrega).  
5. Si el cliente muestra interés → invitar a agendar una cita en el siguiente flujo.  

Directrices:
- Respuestas cortas, claras y con emojis 🏡✨.  
- Usa *negritas* para destacar puntos clave.  
- Si pregunta algo fuera del tema inmobiliario, responde:  
  "Lo siento 😅, solo puedo ayudarte con información inmobiliaria de Homisell."  

Ejemplos de respuesta:
- "Perfecto ✨, ¿me confirmas en qué distrito te interesa buscar tu depa?"  
- "Genial 🏡, tenemos proyectos en *San Borja* desde **$120,000**. ¿Quieres que te muestre 3 opciones recomendadas?"  
- "Claro 👌, pero primero necesito tu *nombre completo* y *número de teléfono* para enviarte precios detallados."  

Respuesta útil:`


export const generatePromptSeller = (history: string) => {
    const nowDate = getFullCurrentDate()
    return PROMPT_SELLER.replace('{HISTORIAL_CONVERSACION}', history).replace('{CURRENT_DAY}', nowDate)
}

export const flowSeller = addKeyword(EVENTS.ACTION).addAction(async (ctx, { state, flowDynamic, extensions }) => {
    try {
        const ai = extensions.ai as AIClass
        const history = getHistoryParse(state as BotState)
        const prompt = generatePromptSeller(history)

        // const text = await safeAiChat(ai, [
        //     { role: "system", content: prompt },
        //     ...getHistoryAsLLMMessages(state as BotState),
        //     { role: "user", content: ctx.body }
        // ])

        const text = await ai.createChat([
            {
                role: 'system',
                content: prompt
            },
            // ...getHistoryAsLLMMessages(state as BotState),
            {
                role: 'user',
                content: ctx.body
            }
        ])

        await handleHistory({ content: text, role: 'assistant' }, state as BotState)

        const chunks = text.split(/(?<!\d)\.\s+/g)
        for (const chunk of chunks) {
            await flowDynamic([{ body: chunk.trim(), delay: generateTimer(150, 250) }])
        }
    } catch (err) {
        console.log(`[ERROR]:`, err)
        return
    }
})
