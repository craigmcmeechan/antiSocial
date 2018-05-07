var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');
var resolveReactionsCommentsAndProfiles = require('../lib/resolveReactionsCommentsAndProfiles');
var resolvePostPhotos = require('../lib/resolvePostPhotos');
var resolvePostOg = require('../lib/resolvePostOG');
var getProfile = require('../lib/getProfile');
var async = require('async');
var debug = require('debug')('proxy');
var utils = require('../lib/endpoint-utils');

var postsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/posts(\.json)?(\?.*)?$/;

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get(postsRE, getCurrentUser(), checkNeedProxyRewrite('posts'), getFriendAccess(), function (req, res, next) {
		var ctx = req.myContext;
		var redirectProxy = ctx.get('redirectProxy');
		if (redirectProxy) {
			return next();
		}

		var matches = req.url.match(postsRE);
		var username = matches[1];
		var view = matches[2];
		var highwater = req.query.highwater;
		var tags = req.query.tags;
		var friend = ctx.get('friendAccess');
		var currentUser = ctx.get('currentUser');
		var isMe = false;

		async.waterfall([
			function (cb) {
				utils.getUser(username, function (err, user) {
					if (err) {
						return cb(err);
					}
					cb(err, user);
				});
			},
			function (user, cb) {
				if (currentUser) {
					if (currentUser.id.toString() === user.id.toString()) {
						isMe = true;
					}
				}
				utils.getPosts(user, friend, highwater, isMe, tags, function (err, posts) {
					cb(err, user, posts);
				});
			},
			function (user, posts, cb) {
				resolvePostPhotos(posts, function (err) {
					cb(err, user, posts);
				});
			},
			function (user, posts, cb) {
				resolvePostOg(posts, function (err, postOgMap) {
					cb(err, user, posts, postOgMap);
				});
			},
			function (user, posts, postOgMap, cb) {
				resolveReactionsCommentsAndProfiles(posts, isMe, function (err) {
					cb(err, user, posts, postOgMap);
				});
			}
		], function (err, user, posts, postOgMap) {
			if (err) {
				if (err.statusCode === 404) {
					return res.sendStatus(404);
				}
				return next(err);
			}

			var data = {
				'pov': {
					'user': user.username,
					'isMe': isMe,
					'friend': friend ? friend.remoteUsername : false,
					'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
				},
				'profile': getProfile(user),
				'posts': posts,
				'highwater': posts && posts.length ? posts[posts.length - 1].createdOn.toISOString() : '',
				'ogMap': postOgMap
			};

			if (view === '.json') {
				return res.send(utils.encryptIfFriend(friend, data));
			}

			var options = {
				'data': data,
				'user': currentUser,
				'friend': friend,
				'isMe': isMe,
				'myEndpoint': utils.getPOVEndpoint(friend, currentUser)
			};

			utils.renderFile('/components/rendered-posts.pug', options, req, function (err, html) {
				if (err) {
					return next(err);
				}
				return res.send(utils.encryptIfFriend(friend, html));
			});
		});
	});

	server.use(router);
};
