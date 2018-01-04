var RemoteRouting = require('loopback-remote-routing');

module.exports = function (Friend) {
	if (!process.env.ADMIN) {
		RemoteRouting(Friend, {
			'only': []
		});
	}
};
