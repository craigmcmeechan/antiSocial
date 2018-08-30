// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var packageInfo = require('../package.json');
var version = packageInfo.version.split('.').shift();
var h = process.env.PUBLIC_HOST || '127.0.0.1';
var port = process.env.PORT ? process.env.PORT : 3000;
var pubPort = process.env.PUBLIC_PORT || port;
var pubProtocol = process.env.PUBLIC_PROTOCOL || 'http';
var pub = pubProtocol + '://' + h;
var websockets = pubProtocol === 'https' ? 'wss://' + h : 'ws://' + h;
if (parseInt(pubPort) !== 80 && parseInt(pubPort) !== 443) {
  pub += ':' + pubPort;
  websockets += ':' + pubPort;
}
module.exports = {
  restApiRoot: '/api' + (version > 0 ? '/v' + version : ''),
  host: h,
  publicPort: pubPort,
  port: port,
  protocol: pubProtocol,
  websockets: websockets,
  publicHost: pub,
  APIVersion: version,
  secureCookiePassword: 'DecodrRing'
};
