import { createFlow } from "@builderbot/bot"
import welcomeFlow from "./welcome.flow"
import { flowLuzIA } from "./luzia.flow"

export default createFlow([
    welcomeFlow,
    flowLuzIA
])
