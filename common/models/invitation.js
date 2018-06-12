// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var RemoteRouting = require('loopback-remote-routing');

module.exports = function (Invitation) {

	if (!process.env.ADMIN) {
		RemoteRouting(Invitation, {
			'only': []
		});
	}

};
