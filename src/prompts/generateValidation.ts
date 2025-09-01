export const generateValidation = (history: string) => {
    return `
        Eres un evaluador.  
        Tienes el historial de un chat donde el bot está siguiendo el Flujo 1.  
        El flujo se considera COMPLETO si:
        - El usuario ya respondió algunas o todas las preguntas.  
        - Y también ya se agendó un horario (ejemplo: mañana, tarde, noche, tal hora, etc.).  

        Historial:  
        ${history}

        Si está completo, responde únicamente con la palabra: "Listo"  
        Si aún faltan datos, responde únicamente con la palabra: "Pendiente"  

        No incluyas explicaciones, ni detalles, ni repitas las preguntas.
    `.trim()
}