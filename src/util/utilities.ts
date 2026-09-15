export const sleep = async (ms: number) => {
  await new Promise(res => setTimeout(res, ms))
}

export const detachVoidPromise = <Args extends unknown[]>(
  callback: (...args: Args) => Promise<void>
) => {
  return (...args: Args) => {
    callback(...args).catch((err) => { console.error(err) })
  }
}