var server = require('../server');

module.exports = function getProfile(user) {
	return {
		'name': user.name,
		'photo': {
			'url': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO).url
		},
		'background': {
			'url': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO).url
		},
		'backgroundSmall': {
			'url': server.locals.getUploadForProperty('background', user.uploads(), 'thumb', server.locals.FPO).url
		},
		'endpoint': server.locals.config.publicHost + '/' + user.username,
		'publicHost': server.locals.config.publicHost
	};
};
