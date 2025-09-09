import axios from 'axios'
import { IHomisellProperty } from '~/types/luzia'

export class HomisellService {
    private endpoint: string
    private apiKey: string

    constructor(endpoint: string, apiKey: string) {
        if (!endpoint || !apiKey) {
            throw new Error("HOMISELL_ENDPOINT and API_KEY are required.")
        }
        this.endpoint = endpoint
        this.apiKey = apiKey
    }

    private get headers() {
        return {
            'X-API-Key': this.apiKey
        }
    }

    private async request(method: string, path: string, body?: any) {
        const response = await fetch(`${this.endpoint}/wp-json/homisell/v1${path}`, {
            method,
            headers: this.headers,
            body: body ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Chatwoot API Error: ${text}`)
        }

        return response.json()
    }

    buildBaseUrl = (route: string) => {
        return `${this.endpoint}/wp-json/homisell/v1${route}`
    }

    async getProperties(): Promise<IHomisellProperty[]> {
        try {
            // const url = this.buildBaseUrl("/propiedades")
            // const response = await fetch(url, {
            //     method: "GET",
            //     headers: this.headers
            // })

            // const jsonData= await response.json()
            // return jsonData.data

            return [{
                id: 1,
                homisell_id: "HMS-5875",
                titulo: "Departamento en venta con vista al mar en la costanera, San Miguel",
                slug: "departamento-en-venta-con-vista-al-mar-en-la-costanera-san-miguel",
                url: "https://homisell.com/propiedad/departamento-en-venta-con-vista-al-mar-en-la-costanera-san-miguel/",
                descripcion_corta: "¡Descubre tu nuevo hogar en San Miguel con una impresionante vista al mar! 🌊 📐 87.00m² de comodidad y estilo🛏 3 dormitorios amplios🚿 2 baños modernos🏡 Piso 7 con vista&hellip;",
                precio: {
                    valor_crudo: 350000,
                    formato_humano: "0",
                    prefijo: "",
                    sufijo: ""
                },
                habitaciones: 1,
                banos: 0,
                area: 0,
                direccion: "San Miguel, Lima, Perú",
                detalles: {
                    generales: [
                        "Lavandería"
                    ],
                    comodidades: {
                        piscina: true,
                        jardin: false,
                        balcon: false,
                        terraza: false,
                        gimnasio: true
                    },
                    servicios: {
                        calefaccion: false,
                        aire_acondicionado: false,
                        amueblado: false,
                        estacionamiento: false
                    }
                },
                coordenadas: {
                    lat: 0,
                    lng: 0
                },
                area_lote: 0,
                garajes: 0,
                fecha_publicacion: "2024-08-19 01:00:41",
                fecha_actualizada: "2024-08-29 17:01:10",
                status_wp: "publish"
            }]
        } catch (error) {
            console.error("Error fetching properties from Homisell API:", error)
            return []
        }
    }
}
