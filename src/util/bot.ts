import {
  ContextMenuCommandBuilder,
  Events,
  type Client,
  type SlashCommandOptionsOnlyBuilder
} from "discord.js"
import { ResultError, type ErrorReport } from "#src/util/result"
import { errorDB } from "#src/db/manager"
import { botErrorCommandsInteraction, commands } from "#src/util/commands"
import { DBError } from "#src/db/common"
import { JsonResultError } from "#src/util/jsonFormat"
import { sleep } from "#src/util/utilities"

class BotError extends Error {
  from: string
  constructor(name: string, from: string) {
    super(name)
    this.from = from
  }
}

export const botError = (from: string) => {
  throw new BotError("Internal Bot Error", from)
}

type ErrorReporter<T extends ErrorReport> =
  ((report: T) => Promise<void>) &
  ((message: string) => Promise<void>)

const DIFY_TIMEOUT = 4000

export abstract class CoreBot<T extends ErrorReport> {
  private lastTimestamp = Date.now()
  constructor(
    protected readonly client: Client<boolean>,
    protected readonly initFlag: boolean) { }

  protected abstract setEventHandlers: () => void

  protected updateTimestamp = async (timestamp: number) => {
    const timeDiff = timestamp - this.lastTimestamp
    if (timeDiff < DIFY_TIMEOUT) {
      this.lastTimestamp += DIFY_TIMEOUT
      await sleep(DIFY_TIMEOUT - timeDiff)
    } else {
      this.lastTimestamp = timestamp + DIFY_TIMEOUT
    }
  }

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

  protected wrapper = <Args extends unknown[]>(
    f: (...args: Args) => Promise<void>
  ) => {
    return async (...args: Args) => {
      try {
        await f(...args)
      } catch (err) {
        if (err instanceof BotError) {
          await this.portErrorReport(
            `Bot Error comes from ${err.from}:\n\`\`\`\n${err}\n\`\`\``
          )
        } else if (err instanceof DBError) {
          await this.portErrorReport(
            `DB Error comes from ${err.from}:\n\`\`\`\n${err}\n\`\`\``
          )
        } else if (err instanceof JsonResultError) {
          await this.portErrorReport(
            `${err.report.name}: ${err.report.message}\n\`\`\`\n${err.report.raw}\n\`\`\``
          )
        } else if (err instanceof ResultError) {
          await this.portErrorReport(
            `${err.report.name}: ${err.report.message}`
          )
        } else {
          await this.portErrorReport(
            `External Error:\n\`\`\`\n${err}\n\`\`\``
          )
        }
      }
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