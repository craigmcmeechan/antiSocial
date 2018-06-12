// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var admin = require('digitopia-admin');
var getCurrentUser = require('../middleware/context-currentUser');
var ensureAdminUser = require('../middleware/context-ensureAdminUser');

module.exports = function (server) {
	if (process.env.ADMIN) {
		var userAuth = [getCurrentUser(), ensureAdminUser()];
		var options = {};
		admin.adminBoot(server, userAuth, 'MyUser', ['MyUser', 'Settings'], options);
	}
};
