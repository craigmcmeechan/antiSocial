// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
var RemoteRouting = require('loopback-remote-routing');

module.exports = function (Request) {
	if (!process.env.ADMIN) {
		RemoteRouting(Request, {
			'only': ['@create']
		});
	}
};
