var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');
var getProfile = require('../lib/getProfile');
var async = require('async');
var debug = require('debug')('proxy');
var utils = require('../lib/endpoint-utils');

var photoRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/photo\/([a-f0-9-]+)(\.json)?$/;

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get(photoRE, getCurrentUser(), checkNeedProxyRewrite('photo'), getFriendAccess(), function (req, res, next) {
		var ctx = req.myContext;
		var redirectProxy = ctx.get('redirectProxy');
		if (redirectProxy) {
			return next();
		}
		var matches = req.url.match(photoRE);
		var username = matches[1];
		var photoId = matches[2];
		var view = matches[3];
		var friend;
		var currentUser;
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
				utils.getPhoto(photoId, user, friend, function (err, photo) {
					if (err) {
						return cb(err);
					}
					cb(err, user, photo);
				});
			}
		], function (err, user, photo) {
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
				'photo': photo
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

			utils.renderFile('/components/rendered-photo.pug', options, req, function (err, html) {
				if (err) {
					return next(err);
				}
				return res.send(utils.encryptIfFriend(friend, html));
			});
		});
	});
	server.use(router);
};
