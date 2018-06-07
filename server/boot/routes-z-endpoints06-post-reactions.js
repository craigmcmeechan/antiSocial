var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');
var resolveProfiles = require('../lib/resolveProfiles');
var resolveReactionsSummary = require('../lib/resolveReactionsSummary');
var resolveReactions = require('../lib/resolveReactions');
var async = require('async');
var debug = require('debug')('proxy');
var utils = require('../lib/endpoint-utils');

var postReactionsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/reactions(\.json)?$/;

module.exports = function(server) {
	var router = server.loopback.Router();

	/**
	 * Retrieve the reactions (likes, etc) to a user's post as HTML or JSON
	 * The reactions being requested could be of a user's post on the server or a
	 * friend of a user on the server. If the request is anonymous, only
	 * public information is returned. If the request is for HTML the
	 * response may include the user's post's reactions either public or, if the
	 * requestor is a friend, reactions based on the visibility allowed for the
	 * requestor.
	 *
	 * @name Get reactions to a user's posts as JSON object or as an HTML page
	 * @path {GET} /:username/post/:postId/reactions[.json]
	 * @params {String} username Username of user on this server or a friend of the logged in user
	 * @params {String} postId Id of wanted post
	 * @params {String} json Append the .json suffix for JSON response otherwise HTML is returned
	 * @auth Anonymous, with valid user credentials or with valid friend credentials
	 * @header {String} friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records
	 * @header {Cookie} access_token Request made by a logged in user on this server (set when user logges in.)
	 * @response {JSON|HTML} If .json is requested returns an array of reaction objects, otherwise HTML
	 */

	router.get(postReactionsRE, getCurrentUser(), checkNeedProxyRewrite('reactions'), getFriendAccess(), function(req, res, next) {
		var ctx = req.myContext;
		var redirectProxy = ctx.get('redirectProxy');
		if (redirectProxy) {
			return next();
		}
		var matches = req.url.match(postReactionsRE);

		var username = matches[1];
		var postId = matches[2];
		var view = matches[3];
		var friend = ctx.get('friendAccess');
		var currentUser = ctx.get('currentUser');

		var isMe = false;

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

				resolveProfiles(post, function(err) {
					cb(err, user, post);
				});
			},
			function(user, post, cb) {

				resolveReactions([post], 'post', function(err) {
					cb(err, user, post);
				});
			},
			function(user, post, cb) {
				async.map(post.resolvedReactions, resolveProfiles, function(err) {
					cb(err, user, post);
				});
			},
			function(user, post, cb) {
				resolveReactionsSummary(post, function(err) {
					cb(err, user, post);
				});
			}
		], function(err, user, post) {
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
				'reactions': post.resolvedReactions ? post.resolvedReactions : [],
				'reactionSummary': post.reactionSummary,
				'poster': post.resolvedProfiles[post.source].profile,
				'about': post.source + '/post/' + post.uuid
			};

			delete data.post.resolvedReactions;
			delete data.post.reactionSummary;

			if (view === '.json') {
				return res.send(utils.encryptIfFriend(friend, data));
			}

			var options = {
				'data': data,
				'user': currentUser,
				'friend': friend,
				'myEndpoint': utils.getPOVEndpoint(friend, currentUser)
			};

			utils.renderFile('/components/rendered-reactions.pug', options, req, function(err, html) {
				if (err) {
					return next(err);
				}
				return res.send(utils.encryptIfFriend(friend, html));
			});
		});
	});

	server.use(router);
};
