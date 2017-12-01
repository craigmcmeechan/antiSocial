var p = require('../package.json');
var version = p.version.split('.').shift();
var h = process.env.PUBLIC_HOST || '127.0.0.1';
var p = process.env.PUBLIC_PORT || 3000;
var protocol = process.env.PUBLIC_PROTOCOL || 'http';
var pub = protocol + '://' + h;
if (parseInt(p) !== 80) {
  pub += ':' + p;
}
module.exports = {
  restApiRoot: '/api' + (version > 0 ? '/v' + version : ''),
  host: h,
  port: p,
  protocol: protocol,
  publicHost: pub
};
