import {
  ContextMenuCommandBuilder,
  Events,
  type Client,
  type SlashCommandOptionsOnlyBuilder
} from "discord.js"
import { type ErrorReport } from "#src/util/result"
import { errorDB } from "#src/db/manager"
import { botErrorCommandsInteraction, commands } from "#src/util/commands"

type ErrorReporter<T extends ErrorReport> =
  ((report: T) => Promise<void>) &
  ((message: string) => Promise<void>)

export abstract class CoreBot<T extends ErrorReport> {
  constructor(
    protected readonly client: Client<boolean>,
    protected readonly initFlag: boolean) { }

  protected abstract setEventHandlers: () => void

  private coreInit = () => {
    this.client.on(Events.InteractionCreate, botErrorCommandsInteraction)
  }

  init = () => {
    if (this.initFlag) { this.coreInit() }
    this.setEventHandlers()
  }

  abstract commands:
    (SlashCommandOptionsOnlyBuilder | ContextMenuCommandBuilder)[]

  protected abstract errorReportToMessage: (report: T) => string

  // sends error message to specific channel 
  protected portErrorReport: ErrorReporter<T> = async (arg: T | string) => {
    const channelID = await errorDB.getFirst()
    const channel =
      await this.client.channels.cache.get(channelID) ??
      await this.client.channels.fetch(channelID)

    if (!(channel?.isSendable())) { return }

    if (typeof arg === "string") {
      await channel.send(arg)
    } else {
      await channel.send(this.errorReportToMessage(arg))
    }
  }

  protected login = async (client: Client<true>) => {
    console.log(`Ready! Logged in as ${client.user.tag}`)
    this.loginCallback()
  }

  protected logout = async () => {
    await this.client.destroy()
  }

  protected abstract loginCallback: () => Promise<void>
}

type CoreBotArgs = ConstructorParameters<typeof CoreBot<ErrorReport>>

const botSetupOne = <C extends CoreBot<never>>(
  BotClass: new (...args: CoreBotArgs) => C,
  client: Client<boolean>,
  head: boolean
) => {
  return new BotClass(client, head)
}

export const botSetup = <
  const T extends Record<string, {
    BotClass: new (...args: CoreBotArgs) => CoreBot<never>,
    client: Client<boolean>
  }
  >>(settings: T) => {
  const res: Record<string, {
    init: () => void,
    commands: (SlashCommandOptionsOnlyBuilder | ContextMenuCommandBuilder)[]
  }> = {}
  Object.entries(settings).forEach(([key, setting], index) => {
    const head = (index === 0)
    const bot = botSetupOne(setting.BotClass, setting.client, true)
    const cmds = head ? [...bot.commands, ...commands] : bot.commands
    res[key] = { init: bot.init, commands: cmds }
  })
  return res as {
    [K in keyof T]: {
      init: () => void,
      commands: (SlashCommandOptionsOnlyBuilder | ContextMenuCommandBuilder)[]
    }
  }
}