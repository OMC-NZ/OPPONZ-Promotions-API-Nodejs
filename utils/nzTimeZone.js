const moment = require("moment-timezone");
const { normalizeText } = require("./text");

const NZ_TIME_ZONE = "Pacific/Auckland";

function getNewZealandTime() {
  return moment().tz(NZ_TIME_ZONE).format("YYYY-MM-DD HH:mm:ss");
}

function getNewZealandTimestamp() {
  return moment().tz(NZ_TIME_ZONE).format();
}

function toNewZealandDateTime(value) {
  const input = normalizeText(value);
  if (!input) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return moment(input, "YYYY-MM-DD", true).isValid() ? `${input} 00:00:00` : null;
  }

  const parsed = moment.parseZone(input, moment.ISO_8601, true);
  if (!parsed.isValid()) {
    const displayDate = moment.tz(input, [
      "D MMM YYYY",
      "DD MMM YYYY",
      "D MMMM YYYY",
      "DD MMMM YYYY",
    ], true, NZ_TIME_ZONE);

    return displayDate.isValid()
      ? displayDate.format("YYYY-MM-DD HH:mm:ss")
      : null;
  }

  return parsed.tz(NZ_TIME_ZONE).format("YYYY-MM-DD HH:mm:ss");
}

module.exports = {
  getNewZealandTime,
  getNewZealandTimestamp,
  toNewZealandDateTime,
};
