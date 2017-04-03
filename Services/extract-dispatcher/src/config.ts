import * as config from 'config'
export function getDefault<T>(key: string, defaultValue: T) {
  return config.has(key)
    ? config.get<T>(key) || defaultValue
    : defaultValue
}
