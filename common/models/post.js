var RemoteRouting = require('loopback-remote-routing');

module.exports = function (Post) {
	if (!process.env.ADMIN) {
		RemoteRouting(Post, {
			'only': []
		});
	}
};
