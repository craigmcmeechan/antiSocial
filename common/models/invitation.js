var RemoteRouting = require('loopback-remote-routing');

module.exports = function (Invitation) {

	if (!process.env.ADMIN) {
		RemoteRouting(Invitation, {
			'only': []
		});
	}

};
