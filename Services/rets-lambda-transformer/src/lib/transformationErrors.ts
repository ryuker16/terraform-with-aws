interface ErrorCallback<T> { (err?: T): void }

export enum TransformationErrorCodes {
  Empty = 0,
  FunctionNotDefined = 1
}

export class TransformationError extends Error {
  constructor(message: string, public code: TransformationErrorCodes) {
    super(message)
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, TransformationError.prototype)
  }
}

export function transformationErrorTaskGenerator(message: string, code: TransformationErrorCodes) {
  return function (values: any[], callback: ErrorCallback<TransformationError>) {
    return callback(new TransformationError(message, code))
  }
}
