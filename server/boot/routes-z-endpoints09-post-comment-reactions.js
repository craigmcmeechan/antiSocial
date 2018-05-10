var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');
var resolveProfiles = require('../lib/resolveProfiles');
var resolveComments = require('../lib/resolveComments');
var async = require('async');
var debug = require('debug')('proxy');
var utils = require('../lib/endpoint-utils');

var postCommentReactionsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/comment\/([a-f0-9-]+)\/reactions(\.json)?$/;

module.exports = function (server) {
	var router = server.loopback.Router();
	router.get(postCommentReactionsRE, getCurrentUser(), checkNeedProxyRewrite('reactions'), getFriendAccess(), function (req, res, next) {
		var ctx = req.myContext;
		var redirectProxy = ctx.get('redirectProxy');
		if (redirectProxy) {
			return next();
		}

		var matches = req.url.match(postCommentReactionsRE);

		var username = matches[1];
		var postId = matches[2];
		var commentId = matches[3];
		var view = matches[4];
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
				resolveComments([post], 'post', isMe, function (err) {
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

			var theComment;
			for (var i = 0; i < post.resolvedComments.length; i++) {
				if (post.resolvedComments[i].uuid === commentId) {
					theComment = post.resolvedComments[i];
					break;
				}
			}

			if (!theComment) {
				return res.sendStatus(404);
			}

			async.map(theComment.resolvedReactions, resolveProfiles, function (err) {

				var data = {
					'pov': {
						'user': user.username,
						'isMe': isMe,
						'friend': friend ? friend.remoteUsername : false,
						'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
					},
					'post': post,
					'comment': theComment,
					'reactions': theComment.resolvedReactions ? theComment.resolvedReactions : [],
					'reactionSummary': theComment.reactionSummary,
					'about': theComment.about + '/comment/' + theComment.uuid
				};

				delete data.post.resolvedComments;
				delete theComment.resolvedReactions;
				delete theComment.reactionSummary;

				if (view === '.json') {
					return res.send(utils.encryptIfFriend(friend, data));
				}

				var options = {
					'data': data,
					'user': currentUser,
					'friend': friend
				};

				utils.renderFile('/components/rendered-reactions.pug', options, req, function (err, html) {
					if (err) {
						return next(err);
					}
					return res.send(utils.encryptIfFriend(friend, html));
				});
			});
		});
	});
	server.use(router);
};
