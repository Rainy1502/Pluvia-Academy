// small formatting helpers used in templates
module.exports = {
  short: (text, len = 80) => text.length > len ? text.slice(0, len) + '…' : text
};
