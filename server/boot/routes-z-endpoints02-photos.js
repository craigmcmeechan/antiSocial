var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');
var getProfile = require('../lib/getProfile');
var async = require('async');
var utils = require('../lib/endpoint-utils');

var photosRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/photos(\.json)?$/;

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get(photosRE, getCurrentUser(), checkNeedProxyRewrite('photos'), getFriendAccess(), function (req, res, next) {
		var ctx = req.myContext;
		var redirectProxy = ctx.get('redirectProxy');
		if (redirectProxy) {
			return next();
		}
		var currentUser = ctx.get('currentUser');
		var friend = ctx.get('friendAccess');

		var matches = req.url.match(photosRE);
		var username = matches[1];
		var view = matches[2];

		var isMe = false;
		async.waterfall([
			function (cb) {
				utils.getUser(username, function (err, user) {
					if (err) {
						return cb(err);
					}
					if (currentUser) {
						if (currentUser.id.toString() === user.id.toString()) {
							isMe = true;
						}
					}

					if (!friend && !isMe) {
						var error = new Error('access denied');
						error.statusCode = 401;
						return cb(error);
					}

					cb(err, user);
				});
			},
			function (user, cb) {
				var query = {
					'where': {
						'userId': user.id
					},
					'include': ['uploads']
				};

				server.models.Photo.find(query, function (err, photos) {
					cb(err, user, photos);
				});
			}
		], function (err, user, photos) {
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
				'photos': photos
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

			utils.renderFile('/components/rendered-photos.pug', options, req, function (err, html) {
				if (err) {
					return next(err);
				}
				return res.send(utils.encryptIfFriend(friend, html));
			});
		});
	});

	server.use(router);
};
