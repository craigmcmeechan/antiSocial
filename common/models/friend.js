// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var RemoteRouting = require('loopback-remote-routing');
var request = require('request');
var url = require('url');

module.exports = function (Friend) {
	if (!process.env.ADMIN) {
		RemoteRouting(Friend, {
			'only': []
		});
	}
};
