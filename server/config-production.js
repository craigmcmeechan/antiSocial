var packageInfo = require('../package.json');
var version = packageInfo.version.split('.').shift();
var h = process.env.PUBLIC_HOST || '127.0.0.1';
var p = process.env.PUBLIC_PORT || 3000;
var protocol = process.env.PUBLIC_PROTOCOL || 'http';
var pub = protocol + '://' + h;
var websockets = protocol === 'https' ? 'wss' : 'ws';
if (parseInt(p) !== 80) {
  pub += ':' + p;
}
module.exports = {
  restApiRoot: '/api' + (version > 0 ? '/v' + version : ''),
  host: h,
  publicPort: p,
  port: process.env.PORT ? process.env.PORT : 3000,
  protocol: protocol,
  websockets: websockets,
  publicHost: pub
};
