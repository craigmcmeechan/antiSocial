var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');
var resolvePostPhotos = require('../lib/resolvePostPhotos');
var async = require('async');
var debug = require('debug')('proxy');
var utils = require('../lib/endpoint-utils');

var postPhotosRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/photos(\.json)?$/;

module.exports = function (server) {
	var router = server.loopback.Router();

	/**
	 * Retrieve the photos for an individual post as HTML or JSON
	 * The photos could be of a user's post on the server or a
	 * friend of a user on the server. If the request is anonymous, only
	 * public information is returned. If the request is for HTML the
	 * response may include the user's post's photos either public or, if the
	 * requestor is a friend, photos based on the visibility allowed for the
	 * requestor.
	 *
	 * @name Get photos for a user's post as JSON object or as an HTML page
	 * @route {GET} /:username/post/:postId/photos[.json]
	 * @routeparam {String} :username Username of user on this server or a friend of the logged in user
	 * @routeparam {String} :postId Id of wanted post
	 * @routeparam {String} .json Append the .json suffix for JSON response otherwise HTML is returned
	 * @authentication Anonymous, with valid user credentials or with valid friend credentials
	 * @headerparam {String} friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records
	 * @headerparam {Cookie} access_token Request made by a logged in user on this server (set when user logges in.)
	 * @returns {JSON|HTML} If .json is requested returns an array of JSON photo objects, otherwise HTML
	 */

	router.get(postPhotosRE, getCurrentUser(), checkNeedProxyRewrite('post-photos'), getFriendAccess(), function (req, res, next) {
		var ctx = req.myContext;
		var redirectProxy = ctx.get('redirectProxy');
		if (redirectProxy) {
			return next();
		}

		var matches = req.url.match(postPhotosRE);

		var username = matches[1];
		var postId = matches[2];
		var view = matches[3];
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

				utils.getPost(postId, user, friend, isMe, function (err, post) {
					if (err) {
						return cb(err);
					}
					cb(err, user, post);
				});
			},
			function (user, post, cb) {
				resolvePostPhotos([post], function (err) {
					cb(err, user, post);
				});
			}
		], function (err, user, post) {
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
				'post': post,
				'photos': post.sortedPhotos ? post.sortedPhotos : []
			};

			delete data.post.sortedPhotos;

			if (view === '.json') {
				return res.send(utils.encryptIfFriend(friend, data));
			}

			var options = {
				'data': data,
				'user': currentUser,
				'friend': friend
			};

			utils.renderFile('/components/rendered-post-photos.pug', options, req, function (err, html) {
				if (err) {
					return next(err);
				}
				return res.send(utils.encryptIfFriend(friend, html));
			});
		});
	});
	server.use(router);
};
