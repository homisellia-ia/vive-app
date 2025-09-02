import { addKeyword, EVENTS } from "@builderbot/bot"
import { generatePrompt } from "~/prompts/generatePrompt"
import { generateTimer } from "~/utils/generateTimer"
import { getHistoryParse, handleHistory, clearHistory, getHistoryAsLLMMessages } from "~/utils/handleHistory"
import { handlerHubspot, hubspot } from "~/services/hubspot"
import AIClass from "~/services/ai"
import { safeJSONParse } from "~/utils/safeJSONParse"
import { sheets } from "~/services/sheets"
import { scheduleReminders } from "~/utils/scheduleReminders"
import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import { IAvailability, IHomisellProperty, IHomisellPropertyMapped } from "~/flows/luzia.d"
import { homisell } from '~/services/homisell'
import { BotState } from "~/types/bot"
import { appToCalendar } from "~/services/calendar"
import { getFullCurrentDate } from "~/utils/currentDate"

// const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/1ovUnirT4K8ajhny_MlkiMGwNfWoj6V9d8RGVUSXexq8/edit?usp=sharing"
// const SPREADSHEET_ID = spreadsheetUrl.split('/')[5]
// const SERVICE_ACCOUNT_EMAIL = process.env.CLIENT_EMAIL
// const PRIVATE_KEY = process.env.PRIVATE_KEY

// const serviceAccountAuth = new JWT({
//     email: SERVICE_ACCOUNT_EMAIL,
//     key: PRIVATE_KEY!.replace(/\\n/g, '\n'),
//     scopes: ['https://www.googleapis.com/auth/spreadsheets'],
// })

// const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth)

// const loadAvailabilitySheet = async (): Promise<IAvailability[]> => {
//     try {
//         await doc.loadInfo()
//         const availabilitySheet = doc.sheetsByTitle['Hoja interna de disponibilidad']
//         const rows = await availabilitySheet.getRows()
//         return rows.map(row => ({
//             proyecto: row.PROYECTO,
//             fecha: row.FECHA,
//             disponible: row.DISPONIBLE === 'Sí'
//         }))
//     } catch (e) {
//         console.error("Error al cargar la hoja de disponibilidad:", e)
//         throw new Error("No se pudo cargar la hoja de disponibilidad.")
//     }
// }

const mapHomisellProperty = (prop: IHomisellProperty): IHomisellPropertyMapped => {
  // Extraer el distrito de la dirección
  const districtMatch = prop.direccion.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\b(?=,|$)/)
  const distrito = districtMatch ? districtMatch[1].trim() : 'No especificado'

  return {
    id: prop.id,
    proyecto: prop.titulo,
    distrito: distrito,
    habitaciones: prop.habitaciones,
    area: prop.area,
    precio: prop.precio.valor_crudo,
    url: prop.url,
    comodidades: prop.detalles.comodidades
  }
}

const generateReport = (property: IHomisellPropertyMapped) => {
    return `
*Proyecto:* ${property.proyecto}
*Ubicación:* ${property.distrito}
*Área total (m²):* ${property.area}
*Dormitorios:* ${property.habitaciones}
*Precio:* $${property.precio.toLocaleString()}
*URL:* ${property.url}
---`
}

const generateJsonParse = (info: string) => {
    const prompt = `tu tarea principal es analizar la información proporcionada en el contexto y generar un objeto JSON que se adhiera a la estructura especificada a continuación. 

    Contexto: "${info}"
    
    {
        "name": "Leifer",
        "interest": "n/a",
        "value": "0",
        "startDate": "2024/02/15 00:00:00"
    }
    
    Objeto JSON a generar:`

    return prompt
}

const generatePromptToFormatDate = (history: string) => {
    const prompt = `Fecha de Hoy:${getFullCurrentDate()}, Basado en el Historial de conversacion: 
    ${history}
    ----------------
    Fecha ideal:...dd / mm hh:mm`

    return prompt
}

export const flowLuzIA = addKeyword(EVENTS.ACTION).addAction(
  async (ctx, { state, flowDynamic, extensions, endFlow }) => {
    try {
      scheduleReminders(ctx, state, flowDynamic, endFlow)

      const ai = extensions.ai as AIClass
      const history = getHistoryParse(state as BotState)

      const homisellProperties = await homisell.getProperties()
      const properties = homisellProperties.map(mapHomisellProperty)

      // const availability = await loadAvailabilitySheet()

      const prompt = generatePrompt(history, properties)

      // const text = await ai.createChat([{ role: 'system', content: prompt }])
      const text = await ai.createChat([
          {
              role: 'system',
              content: prompt
          },
          ...getHistoryAsLLMMessages(state as BotState),
          {
              role: 'user',
              content: ctx.body
          }
      ])

      if (!text || typeof text !== 'string' || text.trim() === '') return await flowDynamic("⚠️ Ocurrió un problema procesando tu mensaje. ¿Podrías repetirlo? 🙏")

      await handleHistory({ content: text, role: 'assistant' }, state as BotState)

      const parsed = await safeJSONParse(
        async () => {
          const retryPrompt = `
            Analiza el historial y extrae la siguiente información:
            - nombre_completo
            - telefono
            - correo
            - proyecto_elegido
            - fecha_cita
            - distrito
            - dormitorios
            - presupuesto
            - comodidades: Devuelve SIEMPRE un array con las claves exactas que coincidan con las propiedades disponibles en el campo "comodidades" de la API.
              Las claves válidas son: ["piscina", "jardin", "balcon", "terraza", "gimnasio"]. 
              Si el usuario no menciona ninguna, devuelve un array vacío [].
              Ejemplo válido: ["piscina", "terraza"].

            Devuelve SOLO un JSON con esos campos. 
          
            Historial: "${history}"
          `
          return await ai.createChat([{ role: 'system', content: retryPrompt }])
        },
        1000
      )

      const parts = text.split(/(?<!\d)\.\s+/g)
      for (const part of parts) {
        await flowDynamic([{ body: part, delay: generateTimer(150, 250) }])
      }

      // console.log(parsed)

      // Etapa 1: Calificación y recopilación de info
      if (!state.get('calificado')) {
        setTimeout(async () => {
          await hubspot.update({ 
            phone: ctx.from, 
            updates: {
              distrito_interes: parsed.distrito,
              dormitorios_necesarios: parsed.dormitorios,
              presupuesto_aprox: parsed.presupuesto
            } 
          })
          await state.update({ calificado: true })
        }, 5000)
        return
      }

      // Etapa 2: Gate Prices y solicitud de datos
      if (!state.get('gate_prices_passed') && (parsed.nombre_completo && parsed.telefono)) {
        setTimeout(async () => {
          await hubspot.update({
            phone: ctx.from,
            updates: {
              firstname: parsed.nombre_completo,
              hs_whatsapp_phone_number: parsed.telefono,
              hubspot_owner_id: "423897229"
            }
          })
          // await hubspot.create({ 
          //   phone: parsed.telefono, 
          //   name: parsed.nombre_completo,
          //   hubspot_owner_id: "423897229"
          // })
          await state.update({ gate_prices_passed: true })
        }, 5000)
        
        // Entregar informes inmediatamente después de obtener datos de contacto
        const filteredProperties = properties.filter(prop => {
          let isValid = true

          if (parsed?.distrito) {
            isValid = isValid && prop.distrito.toLowerCase() === parsed.distrito.toLowerCase()
          }

          if (parsed?.dormitorios) {
            isValid = isValid && Number(prop.habitaciones) === Number(parsed.dormitorios)
          }

          if (parsed?.presupuesto) {
            isValid = isValid && Number(prop.precio) <= Number(parsed.presupuesto)
          }

          if (parsed?.comodidades?.length > 0) {
            let comodidadMatch = true

            for (const c of parsed.comodidades) {
              const tiene = prop.comodidades[c] === true
              if (tiene) {
                console.log(`Tenemos ${c}`)
                // comodidadMatch = comodidadMatch && tiene
              } else {
                console.log(`No tenemos ${c}`)
                // comodidadMatch = false
              }
              comodidadMatch = comodidadMatch && tiene
            }

            isValid = isValid && comodidadMatch
          }

          return isValid
        })

        // console.log("Filter:", filteredProperties)

        if (filteredProperties.length > 0) {
            const reports = filteredProperties.slice(0, 3).map(generateReport).join('\n\n')
            await flowDynamic([{ body: "¡Excelente! Preparé estas 3 opciones para ti.\n\n" + reports }])
    
            const recommendedProjects = filteredProperties.slice(0, 3).map(p => p.proyecto).join(', ')
            setTimeout(async () => {
              await hubspot.update({ 
                phone: ctx.from, 
                updates: { 
                  proyectos_recomendados: reports,
                  dormitorios_necesarios: parsed.dormitorios
                } 
              })
            }, 5000)
            
            await state.update({ informes_entregados: true, recommended_projects: recommendedProjects })
            await flowDynamic([{ body: "¿Cuál de estos proyectos te interesa más?" }])
        } else {
            await flowDynamic("Lo siento, no pude encontrar proyectos que coincidan con tus criterios. ¿Te gustaría buscar con otros parámetros?")
        }
        return
      }

      console.log(parsed)

      // Etapa 3: Selección de proyecto y validación de disponibilidad
      // if (state.get('informes_entregados') && !state.get('cita_agendada') && (parsed.proyecto_elegido && parsed.fecha_cita)) {
        // console.log("informes_entregados")
        // const userChoice = parsed.proyecto_elegido
        // const userDate = parsed.fecha_cita
        // setTimeout(async () => {
        //   await hubspot.update({ phone: ctx.from, updates: { proyecto_elegido: parsed.proyecto_elegido } })
        // }, 5000)

        // const text = await ai.createChat([
        //     {
        //         role: 'system',
        //         content: generatePromptToFormatDate(history)
        //     }
        // ])

        // await handleHistory({ content: text, role: 'assistant' }, state as BotState)
        // await flowDynamic(`¿Me confirmas fecha y hora?: ${text}`)
        // await state.update({ startDate: text })

        
        // const isAvailable = availability.some(av => av.proyecto.toLowerCase() === userChoice.toLowerCase() && av.fecha === userDate && av.disponible)

        // if (isAvailable) {
        //   await hubspot.update({ phone: ctx.from, updates: { fecha_cita: userDate } })
        //   await flowDynamic(`¡Excelente! La fecha seleccionada está disponible. Te confirmo tu cita/visita para el proyecto ${userChoice} el día ${userDate} 📅.`)
        //   await state.update({ cita_agendada: true })
        //   await flowDynamic("¿Me compartes tu correo electrónico para enviarte el informe y la confirmación de la visita?")
        // } else {
        //   const alternativeDates = availability
        //       .filter(av => av.proyecto.toLowerCase() === userChoice.toLowerCase() && av.disponible)
        //       .map(av => av.fecha)
        //       .slice(0, 3)
        //       .join(', ')
        //   await flowDynamic(`Esa fecha ya no está disponible 😕. Estas son las fechas próximas que puedo ofrecerte para el proyecto ${userChoice}: ${alternativeDates}. ¿Cuál prefieres?`)
        // }
        // return
      // }

      // Etapa 4: Cierre y seguimiento con email
      if (!state.get('cita_agendada') && parsed.correo) {
        setTimeout(async () => {
          await hubspot.update({ phone: ctx.from, updates: { email: parsed.correo, proyecto_elegido: parsed.proyecto_elegido } })
        }, 5000)

        const infoCustomer = `Name: ${parsed.nombre_completo}, StarteDate: ${parsed.fecha_cita}, email: ${parsed.correo}`
        console.log(infoCustomer)
        const ai = extensions.ai as AIClass

        const text = await ai.createChat([
            {
                role: 'system',
                content: generateJsonParse(infoCustomer)
            }
        ])

        await appToCalendar(text)

        await flowDynamic("¡Genial! Recibirás el informe detallado y la confirmación de la visita en tu correo. ¿Hay algo más en lo que pueda ayudarte hoy? 😊")
        // await state.update({ finished: true })
        // await clearHistory(state as BotState)
        // return endFlow()
      }
    } catch (err) {
      console.error(`[ERROR]:`, err)
      return await flowDynamic("⚠️ Lo siento, ocurrió un error inesperado. Por favor, intenta de nuevo más tarde.")
    }
  }
)
