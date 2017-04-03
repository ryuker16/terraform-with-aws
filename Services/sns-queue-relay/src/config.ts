import * as config from 'config'
export function getDefault<T>(key: string, defaultValue: T) {
  /* istanbul ignore next */
  return config.has(key)
    ? config.get<T>(key) || defaultValue
    : defaultValue
}
