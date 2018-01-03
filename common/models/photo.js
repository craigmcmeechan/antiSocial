var uploadable = require('../../server/lib/uploadable')();
var RemoteRouting = require('loopback-remote-routing');

module.exports = function (Photo) {
	if (!process.env.ADMIN) {
		RemoteRouting(Photo, {
			'only': []
		});
	}

	Photo.on('attached', function () {
		// on Upload make versions for various UI uses
		var versions = {
			'optimized': [{
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

		uploadable(Photo, 'Photo', versions);
	});
};
