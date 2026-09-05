const UNWRAP_ERROR = "Unwrapping Failure"

export class ResultError extends Error {
  report: ErrorReport
  constructor(name: string, report: ErrorReport) {
    super(name)
    this.report = report
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