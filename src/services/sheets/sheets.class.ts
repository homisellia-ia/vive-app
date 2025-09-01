import { google } from "googleapis"
import { sheets_v4 } from "googleapis/build/src/apis/sheets"

export class SheetsClass {
    private sheets: sheets_v4.Sheets
    private spreadsheetId: string

    constructor(spreadsheetId: string, privateKey: string, clientEmail: string) {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                private_key: privateKey,
                client_email: clientEmail,
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        })

        this.sheets = google.sheets({ version: "v4", auth })
        this.spreadsheetId = spreadsheetId
    }

     userExists = async (number: string) => {
        try {
            const result = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: "Contactos!C:C",
            })

            const rows = result.data.values
            if (rows) {
                const numbers = rows.map(row => row[0])
                return numbers.includes(number)
            }
            return false
        } catch (error) {
            console.error("Error al verificar si el usuario existe:", error)
            return false   
        }
    }

    create = async (
        owner: string,
        phone: string, 
        name: string,
        date: string, 
        campaign: string = "", 
        career: string = "",
        email: string = "",
        scoretag: string = "",
        score: string = "",
        webinar: string = ""
    ) => {
        try {
            const exists = await this.userExists(phone)
            if (exists) {
                //  console.log(`ℹ️  Usuario ${phone} ya existe en Sheets, no se creará`)
                return
            }

            const result = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: "Contactos!A:A"
            })
            const nextRow = (result.data.values?.length || 0) + 1

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `Contactos!A${nextRow}:J${nextRow}`,
                valueInputOption: "RAW",
                requestBody: {
                    values: [[owner, career, phone, campaign, name, date, email, scoretag, score, webinar]]
                }
            })

            // console.log(`✅ Usuario ${phone} creado en fila ${nextRow}`)
        } catch (error) {
            console.error("Error al crear el usuario o nueva pestaña:", error)
        }
    }

    update = async ({ phone, updates }: { phone: string; updates: Record<string, any> }) => {
        try {
            const columnMap = {
                owner: "Propietario del contacto",
                career: "Seleccionar Carrera de Interes",
                number: "Número",
                campaign: "Campaña",
                name: "Nombre",
                date: "Fecha",
                email: "Correo",
                scoretag: "Score",
                score: "Puntaje",
                webinar: "Webinar"
            }
            
            const result = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: "Contactos!A:J"
            })

            const rows = result.data.values
            if (!rows) throw new Error("No se encontraron datos en la hoja")

            const headerRow = rows[0]
            const phoneColIndex = 2 // Columna C
            const rowIndex = rows.findIndex((row, i) => i > 0 && row[phoneColIndex] === phone)

            if (rowIndex === -1) throw new Error(`No se encontró el número: ${phone}`)

            const updatedRow = [...rows[rowIndex]]
            for (const key in updates) {
                const sheetHeader = columnMap[key]
                if (!sheetHeader) continue
                const colIndex = headerRow.indexOf(sheetHeader)
                if (colIndex !== -1) updatedRow[colIndex] = updates[key]
            }

            const updateRange = `Contactos!A${rowIndex + 1}:J${rowIndex + 1}`
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: updateRange,
                valueInputOption: "RAW",
                requestBody: {
                    values: [updatedRow],
                },
            })

            // console.log(`Fila actualizada correctamente para el número ${phone}`)
        } catch (error) {
            console.error("Error al actualizar el usuario:", error)
        }
    }
}
