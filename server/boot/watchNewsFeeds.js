var watchFeed = require('../lib/watchFeed.js')

module.exports = function (server) {
	return;

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
			watchFeed.connect(server, friend);
		}
	});
};
