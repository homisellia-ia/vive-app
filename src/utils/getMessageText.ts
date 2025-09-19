import { downloadMediaMessage } from "@whiskeysockets/baileys"
import fs from "fs"
import path from "path"
import { config } from "~/config"

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads")
const ensureUploadsDir = () => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "audio/ogg; codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "application/pdf": "pdf",
}
const extFromMime = (mime: string) => {
    return MIME_TO_EXT[mime] || mime.split("/")[1] || "bin"
}

export async function getMessageParts(payload: any, provider: any): Promise<{ text: string; attachments: any[] }> {
    const type = payload.message ? Object.keys(payload.message)[0] : "unknown"

    // texto plano
    if (type === "conversation") {
        return { text: payload.message.conversation, attachments: [] }
    }
    if (type === "extendedTextMessage") {
        return { text: payload.message.extendedTextMessage.text, attachments: [] }
    }

    // plantilla / botones / listas (por si llegan desde anuncio)
    if (payload.message?.templateMessage?.hydratedTemplate?.hydratedContentText) {
        return { text: payload.message.templateMessage.hydratedTemplate.hydratedContentText, attachments: [] }
    }
    if (payload.message?.buttonsResponseMessage?.selectedButtonId) {
        const txt = payload.message.buttonsResponseMessage?.selectedDisplayText || payload.message.buttonsResponseMessage.selectedButtonId
        return { text: txt, attachments: [] }
    }
    if (payload.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
        const txt = payload.message.listResponseMessage?.title || payload.message.listResponseMessage.singleSelectReply.selectedRowId
        return { text: txt, attachments: [] }
    }

    // imagen
    if (type === "imageMessage") {
        try {
            ensureUploadsDir()

            const buffer = await downloadMediaMessage(payload, "buffer", {}, {
                logger: provider.logger,
                reuploadRequest: provider.updateMediaMessage,
            })

            const mimeType: string = payload.message.imageMessage.mimetype || "image/jpeg"
            const ext = extFromMime(mimeType)

            // const baseNameRaw =
            //     payload.message.imageMessage.fileName?.replace(/\.[^/.]+$/, "") ||
            //     `img_${payload.from}_${Date.now()}`

            // const safeBase = String(baseNameRaw).replace(/[^a-zA-Z0-9_\-]/g, "_")
            const safeBase = `img_${payload.from}_${Date.now()}`
            const fileName = `${safeBase}.${ext}`
            const filePath = path.join(UPLOADS_DIR, fileName)

            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, buffer)
            }

            const url = `${config.botUrl}/uploads/${fileName}`
            const caption = payload.message.imageMessage.caption || ""

            return {
                text: caption || "📷 Imagen",
                attachments: [
                    {
                        file_type: "image",
                        file_url: url,
                        file_name: fileName
                    }
                ]
            }
        } catch (e) {
            console.error("Error guardando imagen:", e)
            return { text: "📷 Imagen (no se pudo guardar)", attachments: [] }
        }
    }

    return { text: "", attachments: [] }
}
