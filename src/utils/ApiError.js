// Class to handle API errors
class ApiError extends Error {
  constructor(
    statusCode, // HTTP Status Code
    message = "Something went wrong", // Default message
    errors = [], // Default errors
    stack = "", // stack trace of the error
  ) {
    super(message); // super is used to call the parent constructor (Error)  with the message argument
    this.statusCode = statusCode; // HTTP Status Code of the error
    this.data = null; // why null? because this is an error response and we don't want to send any data in the response
    this.errors = errors; // Array of errors
    this.stack = stack; // stack trace of the error
  }
}

export { ApiError }; // named export
