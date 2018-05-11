var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');
var getProfile = require('../lib/getProfile');
var async = require('async');
var utils = require('../lib/endpoint-utils');

var photosRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/photos(\.json)?$/;

module.exports = function (server) {
	var router = server.loopback.Router();

	/**
	 * Retrieve a user's photos as HTML or JSON
	 * The photos being requested could be of a user's on the server or a
	 * friend of a user on the server. If the request is anonymous, only
	 * public information is returned. If the request is for HTML the
	 * response may include the user's photos either public or, if the
	 * requestor is a friend, photos based on the visibility allowed for the
	 * requestor.
	 *
	 * @name Get user's photos as JSON object or as an HTML page
	 * @route {GET} /:username/photos[.json] 
	 * @routeparam {String} :username Username of user on this server or a friend of the logged in user
	 * @routeparam {String} .json Append the .json suffix for JSON response otherwise HTML is returned
	 * @queryparam {String} tags Filter photos by tags. eg. ?tags=["%23randompic"] returns only photos hashtagged with #randompic (HTML mode only)
	 * @authentication Anonymous, with valid user credentials or with valid friend credentials
	 * @headerparam {String} friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records
	 * @headerparam {Cookie} access_token Request made by a logged in user on this server (set when user logges in.)
	 * @returns {JSON|HTML} If .json is requested returns an array of photo objects, otherwise HTML
	 */

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
