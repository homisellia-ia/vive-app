import { addKeyword, EVENTS } from "@builderbot/bot"
import { generatePrompt } from "~/prompts/generatePrompt"
import { generateTimer } from "~/utils/generateTimer"
import { getHistoryParse, handleHistory, clearHistory, getHistory } from "~/utils/handleHistory"
import { handlerHubspot, hubspot } from "~/services/hubspot"
import AIClass from "~/services/ai"
import { safeJSONParse } from "~/utils/safeJSONParse"
import { scheduleReminders } from "~/utils/scheduleReminders"
import { IAvailability, IConfirmedData, IHomisellProperty, IHomisellPropertyMapped } from "~/types/luzia"
import { homisell } from '~/services/homisell'
import { BotState } from "~/types/bot"
import { appToCalendar } from "~/services/calendar"
import { getFullCurrentDate } from "~/utils/currentDate"
import { globalFlags } from "~/core/globals"

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
    ---
  `
}

const confirmedData: IConfirmedData = {
  district: null,
  bedrooms: null,
  budget: null,
  name: null,
  phone: null,
  chosen_project: null,
  startDate: null,
}

// let existingEmail: string | null = null

export const flowLuzIA = addKeyword(EVENTS.ACTION).addAction(
  async (ctx, { state, flowDynamic, extensions, endFlow }) => {
    try {
      scheduleReminders(ctx, state, flowDynamic, endFlow)
      
      const homisellProperties = await homisell.getProperties()
      const properties = homisellProperties.map(mapHomisellProperty)
      
      const history = getHistoryParse(state as BotState)
      
      const ai = extensions.ai as AIClass

      const parsed = await safeJSONParse(
        async () => {
          const retryPrompt = `
            Hoy es: ${getFullCurrentDate()}

            Tarea: Lee el HISTORIAL_DE_CONVERSACION y devuelve SOLO un JSON con los campos definidos. 
            - Si un campo no aparece o es inválido, devuélvelo como null.
            - Usa solo datos confirmados por la IA.
            - No incluyas explicaciones fuera del JSON.

            HISTORIAL_CONFIRMADO:
            ${JSON.stringify(getHistory(state as BotState))}

            PROYECTOS_RECOMENDADOS:
            ${state.get('recommended_projects') || ""}

            FORMATO JSON:
            {
              "nombre_completo": string | null,
              "telefono": string | null,
              "correo": string | null,
              "proyecto_elegido": string | null,
              "fecha_cita": string | null,
              "distrito": string | null,
              "dormitorios": number | null,
              "presupuesto": string | null,
              "nota": string | null,
              "etiqueta_puntaje": "Baja" | "Media" | "Alta" | null,
              "puntaje_total": number | null,
            }

            ─────────────────────────────
            REGLAS DE NEGOCIO
            - Usa solo los datos confirmados.
            - El usuario responderá con un número (1, 2 o 3).
            - proyecto_elegido: Usa el nombre del proyecto {{PROYECTO}} correspondiente de PROYECTOS_RECOMENDADOS según ese número.
            - fecha_cita: SIEMPRE en formato *YYYY/MM/DD HH:MM:SS* en 24 horas, Null si no se indica.
            - distrito: null si genérico o inválido. Si existe, mostrar con mayúscula inicial en cada palabra. Ej: "San Miguel".
            - telefono: null si no tiene entre 7-15 dígitos.
            - correo: null si no es válido o no se llegó al paso de pedir correo.
            - presupuesto: null si no hay número claro. Si existe, mostrar formateado con comas como separador de miles.
            - nombre_completo: null si es solo un nombre corto. Si existe, mostrar con mayúscula inicial en cada palabra. Ej: "Antony Espinoza".
            - nota: Resume en una frase las acciones y comportamiento del usuario durante la conversación.  
                Ejemplo: "El usuario confirmó distrito y número de dormitorios, proporcionó teléfono, mostró interés en agendar cita."
            - puntaje_total: Suma los puntos asignados por:
                1. Tipo de usuario (Pipeline):
                    - Curioso Explorador: 2
                    - Investigar Cauteloso: 5
                    - Profesional Apurado: 8
                    - Inversionista: 6
                2. Señales típicas relevantes (1-3)
                3. Tono y ritmo coincidente (1-3)
                4. Preguntas prioritarias respondidas (1-3)
            - etiqueta_puntaje: "Baja" si puntaje_total 0-9, "Media" si 10-15, "Alta" si 16-25
          `
          return await ai.createChat([{ role: 'system', content: retryPrompt }])
        },
        1000
      )

      const data = {
        phone: parsed.telefono ?? null,
        name: parsed.nombre_completo ?? null,
        startDate: parsed.fecha_cita ?? null,
        email: parsed.correo ?? null,
        note: parsed.nota ?? null,
        budget: parsed.presupuesto ?? null,
        bedrooms: parsed.dormitorios ?? null,
        district: parsed.distrito ?? null,
        chosen_project: parsed.proyecto_elegido ?? null,
        score_tag: parsed.etiqueta_puntaje ?? null,
        total_score: parsed.puntaje_total ?? null,
      }

      for (const key in data) {
        if (confirmedData[key] === null && data[key] !== null) {
          confirmedData[key] = data[key]
        }
      }

      const prompt = generatePrompt(history, properties, confirmedData, state.get('recommended_projects'))

      const text = await ai.createChat([
        { role: 'system', content: prompt },
        ...getHistory(state as BotState).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: ctx.body }
      ])

      if (!text || typeof text !== 'string' || text.trim() === '') {
        return await flowDynamic("⚠️ Ocurrió un problema procesando tu mensaje. ¿Podrías repetirlo? 🙏")
      }

      // console.log("Datos confirmados:", confirmedData)

      if (!state.get('calificado')) {
      //   setTimeout(async () => {
      //     await hubspot.update({ 
      //       phone: ctx.from, 
      //       updates: {
      //         distrito_interes: confirmedData.district,
      //         dormitorios_necesarios: confirmedData.bedrooms,
      //         presupuesto_aprox: confirmedData.budget
      //       } 
      //     })
          await state.update({ calificado: true })
      //   }, 5000)
      }

      if (!state.get('gate_prices_passed') && (confirmedData.name && confirmedData.phone)) {
        // setTimeout(async () => {
        //   await hubspot.update({
        //     phone: ctx.from,
        //     updates: {
        //       firstname: confirmedData.name,
        //       hs_whatsapp_phone_number: confirmedData.phone
        //     }
        //   })
          await state.update({ gate_prices_passed: true })
        // }, 5000)
        
        const filteredProperties = properties.filter(prop => {
          let isValid = true

          if (confirmedData?.district) {
            isValid = isValid && prop.distrito.toLowerCase() === confirmedData.district.toLowerCase()
          }

          // if (confirmedData?.bedrooms) {
          //   isValid = isValid && Number(prop.habitaciones) === Number(confirmedData.bedrooms)
          // }

          // if (confirmedData?.budget) {
          //   const budgetNumber = parseInt(confirmedData.budget.replace(/,/g, ''), 10)
          //   isValid = isValid && Number(prop.precio) <= budgetNumber
          // }

          // if (parsed?.comodidades?.length > 0) {
          //   let comodidadMatch = true

          //   for (const c of parsed.comodidades) {
          //     const tiene = prop.comodidades[c] === true
          //     if (tiene) {
          //       console.log(`Tenemos ${c}`)
          //       // comodidadMatch = comodidadMatch && tiene
          //     } else {
          //       console.log(`No tenemos ${c}`)
          //       // comodidadMatch = false
          //     }
          //     comodidadMatch = comodidadMatch && tiene
          //   }

          //   isValid = isValid && comodidadMatch
          // }

          return isValid
        })

        if (filteredProperties.length > 0) {
          const reports = filteredProperties.slice(0, 3)
            .map((prop, index) => `${index + 1}. ${generateReport(prop)}`)
            .join('\n\n')

          await flowDynamic([{ body: "¡Excelente! Preparé estas 3 opciones para ti.\n\n" + reports }])
          // await flowDynamic([{ body: "Por favor, indícame el número del proyecto que más te interesa (1, 2 o 3)." }])
  
          const recommendedProjects = filteredProperties.slice(0, 3)
            // .map(p => p.proyecto).join(', ')
            .map((prop, index) => `${index + 1}. ${prop.proyecto}`)
            .join('\n')
          
          // setTimeout(async () => {
          //   await hubspot.update({ 
          //     phone: ctx.from, 
          //     updates: { 
          //       proyectos_recomendados: reports,
          //       dormitorios_necesarios: confirmedData.bedrooms
          //     } 
          //   })
          // }, 5000)
          
          await state.update({ 
            informes_entregados: true, 
            recommended_projects: recommendedProjects,
            reports_projects: reports
          })

          // await flowDynamic([{ body: "¿Cuál de estos proyectos te interesa más?" }])
        } else {
          await flowDynamic("Lo siento, no pude encontrar proyectos que coincidan con tus criterios. ¿Te gustaría buscar con otros parámetros?")
        }
      }

      // console.log(parsed)
      // console.log(data.email)
      // console.log(existingEmail)

      if (!state.get('cita_agendada') && data.email) {
        // const existing = await hubspot.searchContactByEmail(data.email)

        // if (existing) {
        //   await flowDynamic(`⚠️  Disculpa, este correo *${data.email}* ya existe en nuestro sistema. 🙏 Podrías brindarme otro correo por favor.`)

        //   existingEmail = data.email
        //   await state.update({ waiting_for_new_email: true })
        //   console.log("Correo existente:", data.email)
        //   return
        // }

        // if (state.get("waiting_for_new_email")) {
        //   await state.update({ waiting_for_new_email: false })
        // }
        // existingEmail = null

        const webinar: "Si" | "No" =
          data.score_tag === "Alta" || (data.total_score && data.total_score >= 16)
            ? "Si"
            : "No"

        const payload = {
          phone: confirmedData.phone ?? "-",
          name: confirmedData.name ?? "-",
          startDate: confirmedData.startDate ?? "-",
          email: data.email ?? "-",
          note: data.note ?? "-",
          budget: confirmedData.budget ?? "-",
          bedrooms: confirmedData.bedrooms ?? "-",
          district: confirmedData.district ?? "-",
          chosen_project: confirmedData.chosen_project ?? "-",
          recommended_project: state.get('recommended_projects') ?? "-",
          score_tag: data.score_tag ?? "-",
          total_score: data.total_score ?? "-",
          webinar
        }

        console.log(payload)

        await appToCalendar(payload)
        // await handlerHubspot({
        //   name: ctx.name,
        //   phone: ctx.from,
        //   hubspot_owner_id: globalFlags.hubspotOwnerId
        // })

        setTimeout(async () => {
          await hubspot.update({ 
            phone: ctx.from, 
            updates: { 
              firstname: payload.name,
              hs_whatsapp_phone_number: payload.phone,
              email: data.email, 
              proyecto_elegido: payload.chosen_project,
              proyectos_recomendados: state.get('reports_projects'),
              dormitorios_necesarios: payload.bedrooms,
              distrito_interes: payload.district,
              presupuesto_aprox: payload.budget,
              hs_content_membership_notes: payload.note
            } 
          })
        }, 5000)
      }

      await handleHistory({ content: text, role: 'assistant' }, state as BotState)

      // const parts = text.split(/(?<!\d)\.\s+/g)
      const parts = text.split(/\n+/g).filter(Boolean)

      for (const part of parts) {
        await flowDynamic([{ body: part, delay: generateTimer(150, 250) }])
      }
    } catch (err) {
      console.error(`[ERROR]:`, err)
      return await flowDynamic("⚠️ Lo siento, ocurrió un error inesperado. Por favor, intenta de nuevo más tarde.")
    }
  }
)
