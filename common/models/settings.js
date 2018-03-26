var RemoteRouting = require('loopback-remote-routing');
var uploadable = require('../../server/lib/uploadable')();

module.exports = function (Settings) {
	if (!process.env.ADMIN) {
		RemoteRouting(Settings, {
			'only': ['@upload']
		});
	}

	// set up uploadable gear for MyUser model
	Settings.on('attached', function () {
		// on Upload make versions for various UI uses
		var versions = {
			'background': [{
				suffix: 'large',
				quality: 90,
				maxHeight: 2048,
				maxWidth: 2048,
			}, {
				suffix: 'thumb',
				quality: 90,
				maxHeight: 300,
				maxWidth: 300,
			}]
		};

		// add uploadable endpoints to MyUser
		uploadable(Settings, 'Settings', versions);
	});
};
