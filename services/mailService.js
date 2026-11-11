const nodemailer = require("nodemailer");
const config = require("../config/envConfig");

let transporter;

const isEmailConfigured = () => Boolean(
    config.email.host && config.email.port && config.email.user && config.email.pass && config.email.from
);

const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            secure: config.email.port === 465,
            requireTLS: true,
            pool: true,
            maxConnections: 3,
            maxMessages: 100,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 30000,
            disableFileAccess: true,
            disableUrlAccess: true,
            auth: { user: config.email.user, pass: config.email.pass },
        });
    }
    return transporter;
};

const closeMailTransporter = () => {
    transporter?.close();
    transporter = undefined;
};

module.exports = { isEmailConfigured, getTransporter, closeMailTransporter };
