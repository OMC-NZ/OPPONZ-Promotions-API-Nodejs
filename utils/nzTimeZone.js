const moment = require('moment-timezone');

function getNewZealandTime() {
    const serverTime = new Date(); // 服务器系统时间（UTC）
    
    // 使用 moment-timezone 将 UTC 时间转换为新西兰时间
    const newZealandTime = moment(serverTime).tz('Pacific/Auckland').format('YYYY-MM-DD HH:mm:ss');
    
    return newZealandTime;
  }

  module.exports = {
    getNewZealandTime
  };