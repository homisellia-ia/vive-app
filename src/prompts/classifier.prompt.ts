export const CLASSIFIER_PROMPT = (history: string) => `
Eres un clasificador de conversaciones.  
Analiza el historial y responde SOLO con la etiqueta del flujo correspondiente, sin explicaciones, sin observaciones, sin texto adicional.
--------------------------------------------------------
Historial de conversación:
${history}

Opciones posibles (elige SOLO UNA):
1. AGENDAR: Esta acción se debe realizar cuando el cliente expresa su deseo de programar una cita.
2. HABLAR: Esta acción se debe realizar cuando el cliente desea hacer una pregunta o necesita más información.
3. CONFIRMAR: Esta acción se debe realizar cuando el cliente y el vendedor llegaron a un acuerdo mutuo proporcionando una fecha, dia y hora exacta sin conflictos de hora.

-----------------------------
Responde con: AGENDAR | HABLAR | CONFIRMAR
`
