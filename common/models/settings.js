var RemoteRouting = require('loopback-remote-routing');

module.exports = function (Settings) {
	if (!process.env.ADMIN) {
		RemoteRouting(Settings, {
			'only': []
		});
	}
};
