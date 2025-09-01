import { config } from "../../config"
import { HomisellService } from "./homisell.class"

export const homisell = new HomisellService(config.homisellEndpoint, config.homisellToken)