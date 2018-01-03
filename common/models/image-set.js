var RemoteRouting = require('loopback-remote-routing');

module.exports = function (ImageSet) {
	if (!process.env.ADMIN) {
		RemoteRouting(ImageSet, {
			'only': []
		});
	}
};
