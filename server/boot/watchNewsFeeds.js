var _ = require('lodash');
var watchFeed = _.throttle(require('../lib/watchFeedWebsockets').connect, 1000);

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


		for (var i = 0; i < friends.length; i++) {
			var friend = friends[i];
			watchFeed(server, friend);
		}
	});
};
