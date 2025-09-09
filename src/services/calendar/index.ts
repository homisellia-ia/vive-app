import { format, addMinutes } from 'date-fns'

const getCurrentCalendar = async (): Promise<string> => {
    const dataCalendarApi = await fetch('https://hook.us2.make.com/sfi6sba12ng5bs7xhde291hoahv97wn3')
    const json: any[] = await dataCalendarApi.json()
    const eventsToShow = json.slice(1)
    const list = eventsToShow.reduce((prev, current) => {
        const startDate = new Date(current.date)
        const endDate = addMinutes(startDate, 45)

        return prev += [
            `Espacio reservado (no disponible): `,
            `Desde ${format(startDate, 'eeee do h:mm a')} `,
            `Hasta ${format(endDate, 'eeee do h:mm a')} \n`,
        ].join(' ')
    }, '')
    return list
}

const appToCalendar = async (payload: Record<string, any>) => {
    try {
        const dataApi = await fetch('https://hook.us2.make.com/2hym693xvchxo3qhjnna2wk8ipr7yljf', {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        })
        return dataApi
    } catch (err) {
        console.log(`error: `, err)
    }
}

export { getCurrentCalendar, appToCalendar }