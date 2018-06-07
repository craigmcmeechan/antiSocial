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

var postRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)(\.json)?(\?embed=1)?(\?source=facebook)?(\?share=1)?$/;

module.exports = function(server) {
	var router = server.loopback.Router();

	/**
	 * Retrieve an individual post for a user as HTML or JSON
	 * The post being requested could be of a user's on the server or a
	 * friend of a user on the server. If the request is anonymous, only
	 * public information is returned. If the request is for HTML the
	 * response will include the user's post either public or, if the
	 * requestor is a friend, the post based on the visibility allowed for the
	 * requestor. Otherwise a 404 error is returned
	 *
	 * @name Get user's individual post as JSON object or as an HTML page
	 * @path {GET} /:username/post/:postId[.json]
	 * @params {String} username Username of user on this server or a friend of the logged in user
	 * @params {String} postId Id of post
	 * @params {String} .json Append the .json suffix for JSON response otherwise HTML is returned
	 * @auth Anonymous, with valid user credentials or with valid friend credentials
	 * @header {String} friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records
	 * @header {Cookie} access_token Request made by a logged in user on this server (set when user logges in.)
	 * @response {JSON|HTML} If .json is requested the post JSON object, otherwise HTML
	 */

	router.get(postRE, getCurrentUser(), checkNeedProxyRewrite('post'), getFriendAccess(), function(req, res, next) {
		var ctx = req.myContext;
		var redirectProxy = ctx.get('redirectProxy');
		if (redirectProxy) {
			return next();
		}
		var matches = req.url.match(postRE);
		var username = matches[1];
		var postId = matches[2];
		var view = matches[3];
		var friend = ctx.get('friendAccess');
		var currentUser = ctx.get('currentUser');
		var isMe = false;
		var isProxy = req.headers['proxy'];

		async.waterfall([
			function(cb) {
				utils.getUser(username, function(err, user) {
					if (err) {
						return cb(err);
					}
					cb(err, user);
				});
			},
			function(user, cb) {
				if (currentUser) {
					if (currentUser.id.toString() === user.id.toString()) {
						isMe = true;
					}
				}
				utils.getPost(postId, user, friend, isMe, function(err, post) {
					if (err) {
						return cb(err);
					}
					cb(err, user, post);
				});
			},
			function(user, post, cb) {
				resolvePostPhotos([post], function(err) {
					cb(err, user, post);
				});
			},
			function(user, post, cb) {
				resolveReactionsCommentsAndProfiles([post], isMe, function(err) {
					cb(err, user, post);
				});
			},
			function(user, post, cb) {
				resolvePostOg([post], function(err, postOgMap) {
					cb(err, user, post, postOgMap);
				});
			}
		], function(err, user, post, postOgMap) {
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
				'post': post,
				'ogMap': postOgMap
			};

			if (view === '.json') {
				return res.send(utils.encryptIfFriend(friend, data));
			}

			var options = {
				'data': data,
				'user': currentUser,
				'friend': friend,
				'isPermalink': req.query.embed ? false : true,
				'isMe': isMe,
				'myEndpoint': utils.getPOVEndpoint(friend, currentUser),
				'source': req.query.source
			};

			utils.renderFile('/components/rendered-post.pug', options, req, function(err, html) {
				if (err) {
					return next(err);
				}
				return res.send(utils.encryptIfFriend(friend, html));
			});
		});
	});

	server.use(router);
};
