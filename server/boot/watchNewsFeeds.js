// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var _ = require('lodash');

module.exports = function (server) {

	var query = {
		'where': {
			and: [{
				'status': 'accepted'
			}, {
				'originator': true
			}]
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
			later(server, friend, i);
		}
	});

	function later(server, friend, i) {
		setTimeout(function () {
			console.log('connecting: ', friend.user().username, friend.remoteUsername);
			server.antisocial.activityFeed.connect(friend.user(), friend);
		}, i * 100);
	}
};
