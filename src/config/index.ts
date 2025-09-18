import "dotenv/config"

export const config = {
    PORT: process.env.PORT ?? 3008,
    // AI
    Model: process.env.MODEL,
    ApiKey: process.env.API_KEY,
    // HubSpot
    hubspotToken: process.env.HUBSPOT_TOKEN,
    hubspotEndpoint: process.env.HUBSPOT_ENDPOINT,
    // Chatwoot
    chatwootAccountID: process.env.ACCOUNT_ID,
    ChatwootToken: process.env.CHATWOOT_TOKEN,
    chatwootEndpoint: process.env.CHATWOOT_ENDPOINT,
    botUrl: process.env.BOT_URL,
    inboxName: process.env.INBOX_NAME,
    // Homisell
    homisellToken: process.env.HOMISELL_TOKEN,
    homisellEndpoint: process.env.HOMISELL_ENDPOINT,
}
