var watchFeed = require('../lib/watchFeedWebsockets');
var _ = require('lodash');

module.exports = function (server) {

	var query = {
		'where': {
			'status': 'accepted'
		},
		'include': ['user']
	};

	server.models.Friend.find(query, function (err, friends) {
		if (err) {
			console.log('Friend.find failed', err);
			return;
		}

		var throttled = _.throttle(watchFeed.connect, 1000);

		for (var i = 0; i < friends.length; i++) {
			var friend = friends[i];
			throttled(server, friend);
		}
	});
};
