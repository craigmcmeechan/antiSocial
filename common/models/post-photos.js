var RemoteRouting = require('loopback-remote-routing');

module.exports = function (PostPhoto) {
	if (!process.env.ADMIN) {
		RemoteRouting(PostPhoto, {
			'only': []
		});
	}
};
