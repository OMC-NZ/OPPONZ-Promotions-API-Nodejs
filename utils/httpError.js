class HttpError extends Error {
    constructor(status, message, options = {}) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        this.publicMessage = options.publicMessage || message;
        this.details = options.details;
    }
}

const createHttpError = (status, message, options) => new HttpError(status, message, options);

module.exports = {
    HttpError,
    createHttpError,
};
