import { MemoryDB, createBot, createProvider } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { config } from "./config"
import { ChatwootClass } from './services/chatwoot/chatwoot.class'
import Queue from "queue-promise"
import ServerHttp from './services/http'

import AIClass from './services/ai'
import flows from './flows'
import { handlerMessage } from './services/chatwoot'
import { handlerHubspot } from './services/hubspot'
import { format } from 'date-fns'
import { getMessageParts } from './utils/getMessageText'
import path from 'path'
import fs from 'fs'

const chatwoot = new ChatwootClass({
    account: config.chatwootAccountID,
    token: config.ChatwootToken,
    endpoint: config.chatwootEndpoint,
})

const queue = new Queue({
    concurrent: 1,
    interval: 500,
})

const ai = new AIClass(config.ApiKey, config.Model)

const loggedTypes = new Set<string>()

const main = async () => {
    const provider = createProvider(Provider)
    
    const bot = await createBot(
        {
            flow: flows,
            provider,
            database: new MemoryDB(),
        },
        {
            extensions: { ai },
            queue: {
                timeout: 20000,
                concurrencyLimit: 50,
            }
        }
    )
    
    const { handleCtx, httpServer } = bot

    new ServerHttp(provider, bot)

    provider.server.get(
        "/v1/health",
        (
            _,
            res: {
                writeHead: (arg0: number, arg1: { "Content-Type": string }) => void
                end: (arg0: string) => void
            }
        ) => {
            res.writeHead(200, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ status: "ok" }))
        }
    )

    provider.server.post(
        "/v1/blackList",
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === "remove") {
                bot.blacklist.remove(number)
                await bot.dispatch("GRACIAS_FLOW", { from: number, name: "Cliente" })
                return res.end("trigger")
            }
            if (intent === "add") {
                bot.blacklist.add(number)
            }
            res.writeHead(200, { "Content-Type": "application/json" })
            return res.end(JSON.stringify({ status: "ok", number, intent }))
        })
    )

    provider.server.get(
        "/uploads/:file",
        (
            req: any,
            res: any
        ) => {
            const file = req.params.file
            const filePath = path.join(process.cwd(), "public", "uploads", file)

            if (!fs.existsSync(filePath)) {
                res.writeHead(404)
                return res.end("Not Found")
            }

            const ext = (file.split(".").pop() || "").toLowerCase()
            const mime =
                ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
                ext === "png" ? "image/png" :
                ext === "webp" ? "image/webp" :
                ext === "mp4" ? "video/mp4" :
                ext === "mp3" ? "audio/mpeg" :
                ext === "ogg" ? "audio/ogg" :
                ext === "pdf" ? "application/pdf" :
                "application/octet-stream"

            res.writeHead(200, { "Content-Type": mime })
            fs.createReadStream(filePath).pipe(res)
        }
    )

    provider.on("message", (payload) => {
        queue.enqueue(async () => {
            try {
                const messageType = payload.message ? Object.keys(payload.message)[0] : "unknown"

                if (!loggedTypes.has(messageType)) {
                    // console.log("📩 Tipo detectado:", messageType, "| Usuario:", payload.from)
                    // console.log("📩 Payload ejemplo:", JSON.stringify(payload, null, 2))
                    loggedTypes.add(messageType)
                }
                
                const { text, attachments } = await getMessageParts(payload, provider)

                if (!text && attachments.length === 0) {
                    console.log(`⛔ No se pudo extraer texto del mensaje | Usuario: ${payload.from}`)
                    return
                }

                // console.log(attachments)

                const agentData = await handlerMessage(
                    {
                        phone: payload.from,
                        name: payload.pushName,
                        message: text,
                        mode: "incoming",
                        attachment: attachments,
                    },
                    chatwoot
                )

                await handlerHubspot({
                    name: payload.pushName,
                    phone: payload.from,
                    hubspot_owner_id: agentData?.hubspotOwnerId ?? ""
                })
            } catch (error) {
                console.log("ERROR", error)
            }
        })
    })

    bot.on("send_message", (payload) => {
        queue.enqueue(async () => {
            const attachment = []

            await handlerMessage(
                {
                    phone: payload.from,
                    name: payload.from,
                    message: payload.answer,
                    mode: "outgoing",
                    attachment: attachment,
                },
                chatwoot
            )
        })
    })
    
    httpServer(+config.PORT)
}

main()
