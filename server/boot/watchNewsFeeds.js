var watchFeed = require('../lib/watchFeed.js')

module.exports = function (server) {
	// look through friends, get unread PushNewsFeedItems then set up
	// eventsource listeners on all friend's hosts to be notified
	// when new PushNewsFeedItems are created on all hosts

	/*
	var query = {
		'where': {
			'or': [{
				'status': 'pending'
			}, {
				'status': 'accepted'
			}]
		},
		'include': ['user']
	}
	*/

	var query = {
		'where': {
			'status': 'accepted'
		},
		'include': ['user']
	}

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
