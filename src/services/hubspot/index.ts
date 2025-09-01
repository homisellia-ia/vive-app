import { config } from "../../config"
import { HubSpotClass } from "./hubspot.class"

const hubspot = new HubSpotClass({
    token: config.hubspotToken!,
    endpoint: config.hubspotEndpoint!,
})

const handlerHubspot = async ({ name, phone, hubspot_owner_id }) => {
    // const existing = await hubspot.searchContactByPhone(phone)
    await hubspot.create({ 
        name, 
        phone,
        hubspot_owner_id
    })
    // return hubspot.update({ phone, updates: { hubspot_owner_id } })
}

export { hubspot, handlerHubspot }
