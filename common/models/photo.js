var uploadable = require('../../server/lib/uploadable')();

module.exports = function (Photo) {
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
			}, {
				suffix: 'icon',
				quality: 90,
				maxWidth: 50,
				maxHeight: 50,
				aspect: '1:1'
			}]
		};

		uploadable(Photo, 'Photo', versions);
	});
};
