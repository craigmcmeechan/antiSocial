'use strict';
var RemoteRouting = require('loopback-remote-routing');

module.exports = function (Request) {
	if (!process.env.ADMIN) {
		RemoteRouting(Request, {
			'only': []
		});
	}
};
