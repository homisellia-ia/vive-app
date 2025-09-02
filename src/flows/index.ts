import { createFlow } from "@builderbot/bot"
import welcomeFlow from "./welcome.flow"
import { flowSeller } from "./seller.flow"
import { flowSchedule } from "./schedule.flow"
import { flowConfirm } from "./confim.flow"
import { flowLuzIA } from "./luzia.flow"

export default createFlow([welcomeFlow, flowLuzIA, flowSeller, flowSchedule, flowConfirm])
