import { InternalError } from "#src/util/utilities"

const UNWRAP_ERROR = "Unwrapping Failure"

export class ResultError extends InternalError {
  report: ErrorReport
  constructor(name: string, report: ErrorReport) {
    super(name)
    this.report = report
  }

  override toString = () => {
    return `${this.report.name}: ${this.report.message}`
  }
}

export type ErrorReport = {
  name: string,
  message: string
}

export type Result<T, S extends ErrorReport> = {
  status: "Success",
  result: T
} | {
  status: "Failure",
  errorReport: S
}

export const throwDefaultResultError = <S extends ErrorReport>(errReport: S) => {
  throw new ResultError(UNWRAP_ERROR, errReport)
}

export const unwrap = <T, S extends ErrorReport>(err: Result<T, S>) => {
  switch (err.status) {
    case ("Success"): {
      return err.result
    }

    case ("Failure"): {
      throw new ResultError(UNWRAP_ERROR, err.errorReport)
    }
  }
}