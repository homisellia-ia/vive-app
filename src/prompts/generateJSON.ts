import { MINI_DICT } from "~/data/miniDict"
import { OFERTAS_OBJ } from "~/data/ofertas"

export const generateSummaryJSON = (info: string, phone: string): string => {
    return `
        Analiza el siguiente historial de conversación entre un CLIENTE (usuario) y un VENDEDOR (asistente IA). El CLIENTE es quien realiza las consultas. El VENDEDOR responde con información del Instituto.

        HISTORIAL: 
        "${info}"

        Catálogo de carreras (ID → nombre → campaign):
        ${OFERTAS_OBJ.map(o => `${o.id} → ${o.name} → ${o.campaign}`).join("\n")}

        Mapeo rápido de términos a IDs:
        ${MINI_DICT}

        Debes devolver **únicamente** un objeto JSON válido, siguiendo exactamente la estructura indicada. No incluyas comentarios, texto adicional ni explicaciones. Solo el JSON.

        {
            "conversation_id": "${phone}",
            "nombre": "Sin datos",
            "carrera_interes": "",
            "prioridad": "
                - "puntaje_total" >= 30 → "Alta".
                - "puntaje_total" >= 10 y <= 29 → "Media".
                - "puntaje_total" < 10 → "Baja".
            ",
            "puntaje_total": 0,
            "inmediatez": "",
            "objetivo": "",
            "experiencia_previa": {
                "tiene_experiencia": false,
                "descripcion": ""
            },
            "tiene_pc": null,
            "ciudad_usuario": "",
            "asiste_webinar": "No",
            "pref_horario_llamada": null,
            "interes_principal": "",
            "observaciones": "",
            "flujo_completo": "No", // Sí si el usuario llegó hasta el final del flujo, No si abandonó antes del paso 3
            "csat": null, // Satisfacción de 1 a 5 si se menciona
            "fuente": "Chatbot ELITEC",
            "fecha_registro": "${new Date().getTime()}",
            "arquetipo": "Joven Explorador",
            "faq_resueltas": []
        }

        Reglas:
        1. Solo extrae datos presentes en el historial.

        2. Generar "conversation_id" usando fecha-hora actual y 4 números aleatorios.
        
        3. "flujo_completo": Sí si se detecta que el usuario respondió todas las preguntas esperadas; No si abandonó antes del paso 3.
        
        4. "csat": si el usuario dio un puntaje de satisfacción (1 a 5), ponerlo; si no, null.

        5. "nombre": el nombre del usuario si lo dijo, de lo contrario "Sin datos".

        6. "carrera_interes": interpretar y normalizar usando el catálogo oficial (mapeo rápido incluido), devolviendo *siempre* el nombre completo de la carrera según el catálogo, no la ID.

        7. "objetivo": debe ser exactamente el valor de "campaign" correspondiente a la carrera detectada. 
          No escribas el nombre de la carrera ni texto adicional. 
          Si no hay coincidencia exacta, dejar como "".

        8. "observaciones": redacta una frase breve y clara con cualquier detalle adicional relevante sobre el comportamiento o actitud del usuario. Ejemplos:
          - "Usuario solo solicitó precios, no se consiguió mayor engagement."
          - "Mostró interés en modalidad online pero no especificó fecha de inicio."
          - "Aceptó webinar y solicitó información del plan de estudios."
          No dejes este campo vacío si hay algo que describir, aunque no sea un dato técnico.

        9. "interes_principal": la motivación más clara (ej. "Consulta de precio", "Solicita temario").

        10. "experiencia_previa": detectar si se menciona y describirla.
        
        11. "asiste_webinar": "Sí" si el usuario ya agendo su horario para contactarse con el asesor o asesora. "No" si no lo menciona.

        12. Calcular "puntaje_total" sumando o restando según estas reglas:
          - Inmediatez:
              +15 → menciona "ya", "ahora", "inmediato".
              +5  → menciona "este año" u otra fecha cercana, pero no inmediata.
              0  → "tal vez el próximo año" o fechas lejanas.

          - Objetivo:
              +5 → menciona "título", "carrera profesional", "profesional".
              +2 → menciona "curso", "curso corto", "certificado".

          - Experiencia previa:
              +3 → experiencia laboral relevante en el área mencionada.
              0 → sin experiencia o no lo menciona.

          - Recursos (PC/Laptop):
              0 → sí tiene.
              -5 → no tiene.

          - Acepta webinar:
              +10 → acepta invitación.
              0  → no acepta.

          - Pregunta precio al inicio:
              -5 → si pregunta antes de seguir el flujo normal.

          - Respuestas evasivas:
              -5 → si da respuestas muy cortas o sin contenido.

          - Preguntas técnicas (plan, modalidad, etc.):
              +5 → si pregunta detalles académicos o técnicos.

          - Objeción de confianza:
              0 → si menciona "estafa", "no confío", pero registrar en "faq_resueltas".

          - Licenciamiento / validez de título:
              0 → no modifica puntaje, pero marcar en "faq_resueltas".

        13. calcular "prioridad" usando el valor del campo "puntaje_total" que vas a devolver:
          - Si menciona "convalidación" o similar → "Alta"

        14. Si algo no se menciona, dejar en null o vacío según corresponda.
        15. La palabra "webinar" se debe interpretar como "asesor", "asesora", "agente humano" o "asistente humano".

        DEVUELVE SOLO EL JSON. No cortes la respuesta.
    `.trim()
}
