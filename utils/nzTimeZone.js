const moment = require("moment-timezone");

const NZ_TIME_ZONE = "Pacific/Auckland";

function getNewZealandTime() {
  return moment().tz(NZ_TIME_ZONE).format("YYYY-MM-DD HH:mm:ss");
}

function getNewZealandTimestamp() {
  return moment().tz(NZ_TIME_ZONE).format();
}

module.exports = {
  getNewZealandTime,
  getNewZealandTimestamp,
};
