import * as config from 'config'
export function getDefault<T>(key: string, defaultValue: T) {
  return config.has(key)
    ? config.get<T>(key) || defaultValue
    : defaultValue
}
export function getDefaultInt(key: string, defaultValue: number): number {
  let value = config.has(key) ? config.get<string | number>(key) : ''
  if (Number.isInteger(value as number)) {
    return value as number
  }
  if (value) {
    return parseInt(value as string, 10)
  }
  return defaultValue
}
export function getDefaultBool(key: string, defaultValue: boolean): boolean {
  if (config.has(key)) {
    let value = config.get<any>(key)
    return typeof value === 'boolean'
      ? value as boolean
      : defaultValue
  }
  return defaultValue
}
