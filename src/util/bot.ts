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
import { detachVoidPromise, sleep } from "#src/util/utilities"
import { difyRequest, type DifyKind } from "#src/util/difyURL"

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

const DIFY_TIMEOUT = 8_000
const DIFY_RETRY_TIMEOUT = 120_000

type RetryState = "Running" | "HalfClosed" | "Closed"

const retryTimeDefault = 4 * 60 * 60 * 1_000
const retryTimeMap = new Map<RetryState, number>([
  ["Running", 1 * 60 * 60 * 1_000],
  ["HalfClosed", 4 * 60 * 60 * 1_000],
  ["Closed", 4 * 60 * 60 * 1_000],
])

const retryRequest = async (kind: DifyKind) => {
  const res = await difyRequest(kind, "接続テスト")
  switch (res.status) {
    case ("Success"): { return true }
    case ("Failure"): { return false }
  }
}

class RetryStateMachine {
  constructor(
    private state: RetryState,
    private getKind: () => DifyKind,
    private leave: () => Promise<void>,
    private recover: () => Promise<void>
  ) { }

  stepFailure = async () => {
    const retryTime = retryTimeMap.get(this.state) ?? retryTimeDefault
    switch (this.state) {
      case ("Running"): {
        this.state = "HalfClosed"
        await this.leave()
        break
      }

      case ("HalfClosed"): {
        this.state = "Closed"
        break
      }

      case ("Closed"): {
        this.state = "Closed"
        break
      }
    }
    await this.setRetryCooldown(this.getKind(), retryTime)
  }

  private stepSuccess = () => { this.state = "Running" }

  setRetryCooldown = async (kind: DifyKind, retryTime: number) => {
    await sleep(retryTime)

    if (this.state === "Running") { return }
    const isRetry = await retryRequest(kind)
    if (isRetry) {
      this.stepSuccess()
      await this.recover()
    } else {
      await this.stepFailure()
    }
  }

  get running() { return (this.state === "Running") }
}

export abstract class CoreBot<T extends ErrorReport> {
  private lastTimestamp: number
  private readonly circuitBreaker = new RetryStateMachine(
    "Running",
    () => this.kind,
    () => this.leave(),
    () => this.recover()
  )
  constructor(
    protected readonly client: Client<boolean>,
    protected readonly initFlag: boolean
  ) {
    this.lastTimestamp = Date.now()
  }

  protected abstract setEventHandlers: () => void
  protected abstract kind: DifyKind
  protected abstract leave: () => Promise<void>
  protected abstract recover: () => Promise<void>

  abstract commands:
    (SlashCommandOptionsOnlyBuilder | ContextMenuCommandBuilder)[]

  protected updateTimestamp = async (timestamp: number) => {
    const timeDiff = timestamp - this.lastTimestamp
    if (timeDiff < DIFY_TIMEOUT) {
      this.lastTimestamp += DIFY_TIMEOUT
      await sleep(DIFY_TIMEOUT - timeDiff)
    } else {
      this.lastTimestamp = timestamp + DIFY_TIMEOUT
    }
  }

  protected retryTimestamp = async (timestamp: number) => {
    this.lastTimestamp = timestamp + DIFY_RETRY_TIMEOUT
    await sleep(DIFY_TIMEOUT + DIFY_RETRY_TIMEOUT)
  }

  protected retry = async () => {
    await this.circuitBreaker.stepFailure()
  }

  get running() {
    return (this.circuitBreaker.running)
  }

  private coreInit = () => {
    this.client.on(Events.InteractionCreate, detachVoidPromise(botErrorCommandsInteraction))
  }

  init = () => {
    if (this.initFlag) { this.coreInit() }
    this.setEventHandlers()
  }

  protected abstract errorReportToMessage: (report: T) => string

  // sends error message to specific channel 
  protected portErrorReport: ErrorReporter<T> = async (arg: T | string) => {
    const channelID = await errorDB.getFirst()
    const channel =
      this.client.channels.cache.get(channelID) ??
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
    return detachVoidPromise(
      async (...args: Args) => {
        if (!this.circuitBreaker.running) { return }
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
              `External Error:\n\`\`\`\n` + String(err) + `\n\`\`\``
            )
          }
        }
      }
    )
  }

  protected login = async (client: Client<true>) => {
    console.log(`Ready! Logged in as ${client.user.tag}`)
    await this.loginCallback()
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