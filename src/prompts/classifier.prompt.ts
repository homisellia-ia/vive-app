export const CLASSIFIER_PROMPT = (history: string) => `
Eres un clasificador de conversaciones.  
Analiza el historial y responde SOLO con la etiqueta del flujo correspondiente, sin explicaciones, sin observaciones, sin texto adicional.

# Historial de conversación
--------------
${history}
--------------

# Opciones posibles (elige SOLO UNA)
1. LUZIA-FLOW: El usuario está interactuando con LuzIA para buscar propiedades, obtener informes y agendar una cita.

-----------------------------
Tu objetivo es comprender la intención del cliente y seleccionar la acción más adecuada en respuesta a su declaración.

Respuesta ideal (LUZIA-FLOW):`
