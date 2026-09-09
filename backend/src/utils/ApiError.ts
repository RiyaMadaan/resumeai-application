/**
 * ApiError — a small typed error carrying an HTTP status code so controllers
 * can throw meaningful errors that the central error middleware turns into
 * clean JSON responses.
 */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }

  static badRequest(message: string) {
    return new ApiError(400, message)
  }
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message)
  }
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message)
  }
  static notFound(message = 'Not found') {
    return new ApiError(404, message)
  }
  static conflict(message: string) {
    return new ApiError(409, message)
  }
  static notImplemented(message = 'Not implemented yet') {
    return new ApiError(501, message)
  }
}
