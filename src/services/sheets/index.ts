import { config } from "~/config"
import { SheetsClass } from "./sheets.class"

const sheets = new SheetsClass(config.spreadsheetId, config.privateKey, config.clientEmail)

const handlerSheets = async ({ phone, name, date, owner }) => {
    await sheets.create(
        owner,      // A
        phone,      // C
        name,       // E
        date        // F
    )
}

export { sheets, handlerSheets }
