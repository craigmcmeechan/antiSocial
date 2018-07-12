var uploadable = require('../../server/lib/uploadable')();

module.exports = function (Community) {
	Community.on('attached', function () {

		var versions = {
			'background': [{
				suffix: 'large',
				quality: 90,
				maxHeight: 2048,
				maxWidth: 2048,
			}, {
				suffix: 'small',
				quality: 90,
				maxHeight: 300,
				maxWidth: 300,
			}]
		};

		// add uploadable endpoints to Community
		uploadable(Community, 'Community', versions);
	});
};
