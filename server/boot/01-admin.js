var admin = require('digitopia-admin');
var getCurrentUser = require('../middleware/context-currentUser');
var ensureAdminUser = require('../middleware/context-ensureAdminUser');

module.exports = function (server) {

	if (process.env.ADMIN) {
		var userAuth = [getCurrentUser(), ensureAdminUser()];
		var options = {
		};
		admin.adminBoot(server, userAuth, 'MyUser', ['MyUser','Settings'], options);
	}
};
