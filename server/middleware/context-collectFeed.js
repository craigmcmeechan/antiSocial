var async = require('async');
var request = require('request');
var VError = require('verror');
var cache = require('../lib/cache');
var uuid = require('uuid');

module.exports = function () {
	return function contextCollectFeed(req, res, next) {
		var reqContext = req.getCurrentContext();
		var currentUser = reqContext.get('currentUser');
		var friends = reqContext.get('friends');
		var scrollSession = reqContext.get('scrollSession');

		//console.log(scrollSession);

		if (!currentUser) {
			return next();
		}

		var allPosts = [];

		for (var i = 0; i < friends.length; i++) {
			var friend = friends[i];
			var posts = scrollSession.posts[friend.endpoint] ? scrollSession.posts[friend.endpoint] : [];
			for (var j = 0; j < posts.length; i++) {
				allPosts.push(posts[j]);
			}
		}

		async.forEachLimit(friends, 20, function (friend, cb) {
			if (friend.status !== 'accepted') {
				return cb();
			}

			var options = {
				'url': friend.remoteEndPoint + '/posts.json',
				'json': true,
				'headers': {
					'friend-access-token': friend ? friend.remoteAccessToken : '',
					'friend-high-water': scrollSession.highwater[friend.remoteEndPoint]
				}
			};

			//console.log(options);

			request.get(options, function (err, response, body) {
				if (err) {
					var e = new VError(err, 'could not load endpoint %j', options);
					return cb(e);
				}

				//console.log(response.statusCode,'posts', body.posts);

				if (response.statusCode === 200 && body.posts) {
					for (var i = 0; i < body.posts.length; i++) {
						allPosts.push(body.posts[i]);
						if (!scrollSession.posts[friend.remoteEndPoint]) {
							scrollSession.highwater[friend.remoteEndPoint] = body.posts[i].id;
							scrollSession.posts[friend.remoteEndPoint] = [];
						}
						scrollSession.posts[friend.remoteEndPoint].push(body.posts[i]);
					}
				}

				cb();
			});
		}, function (err) {
			allPosts.sort(byCreatedOn).reverse();
			var page = scrollSession.page;
			reqContext.set('feed', allPosts.slice(page * 10, 9));
			next(err);
		});
	};

	function byCreatedOn(a, b) {
		if (a.createdOn < b.createdOn) {
			return -1;
		}
		if (a.createdOn > b.createdOn) {
			return 1;
		}
		return 0;
	}
};
