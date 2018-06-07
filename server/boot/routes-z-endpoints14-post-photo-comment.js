var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');
var resolveProfiles = require('../lib/resolveProfiles');
var resolveComments = require('../lib/resolveComments');
var resolvePostPhotos = require('../lib/resolvePostPhotos');
var async = require('async');
var debug = require('debug')('proxy');
var utils = require('../lib/endpoint-utils');

var postPhotoCommentRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/photo\/([a-f0-9-]+)\/comment\/([a-f0-9-]+)(\.json)?$/;

module.exports = function (server) {
	var router = server.loopback.Router();

	/**
	 * Retrieve an individual comment on a user's photo as HTML or JSON
	 * The comments being requested could be of a user's post on the server or a
	 * friend of a user on the server. If the request is anonymous, only
	 * public information is returned. If the request is for HTML the
	 * response may include the user's photo's comments either public or, if the
	 * requestor is a friend, comments based on the visibility allowed for the
	 * requestor.
	 *
	 * @name Get a comment for a user's post's photo as JSON object or as an HTML page
	 * @path {GET} /:username/post/:postId/photo/:photoId/comment/:commentId[.json]
	 * @params {String} username Username of user on this server or a friend of the logged in user
	 * @params {String} postId Id of wanted post
	 * @params {String} photoId Id of wanted post
	 * @params {String} commentId Id of wanted comment
	 * @params {String} .json Append the .json suffix for JSON response otherwise HTML is returned
	 * @auth Anonymous, with valid user credentials or with valid friend credentials
	 * @header {String} friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records
	 * @header {Cookie} access_token Request made by a logged in user on this server (set when user logges in.)
	 * @response {JSON|HTML} If .json is requested returns a JSON comment object, otherwise HTML
	 */

	router.get(postPhotoCommentRE, getCurrentUser(), checkNeedProxyRewrite('comment'), getFriendAccess(), function (req, res, next) {
		var ctx = req.myContext;
		var redirectProxy = ctx.get('redirectProxy');
		if (redirectProxy) {
			return next();
		}

		var matches = req.url.match(postPhotoCommentRE);

		var username = matches[1];
		var postId = matches[2];
		var photoId = matches[3];
		var commentId = matches[4];
		var view = matches[5];
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

			var thePhoto;

			for (var i = 0; i < post.sortedPhotos.length; i++) {
				if (post.sortedPhotos[i].uuid === photoId) {
					thePhoto = post.sortedPhotos[i];
					break;
				}
			}

			if (!thePhoto) {
				return res.sendStatus(404);
			}

			thePhoto.about = post.source + '/post/' + post.uuid;
			resolveComments([thePhoto], 'photo', isMe, function (err) {

				var theComment;
				for (var i = 0; i < thePhoto.resolvedComments.length; i++) {
					if (thePhoto.resolvedComments[i].uuid === commentId) {
						theComment = thePhoto.resolvedComments[i];
						break;
					}
				}

				if (!theComment) {
					return res.sendStatus(404);
				}

				async.map([theComment], resolveProfiles, function (err) {

					var data = {
						'pov': {
							'user': user.username,
							'isMe': isMe,
							'friend': friend ? friend.remoteUsername : false,
							'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
						},
						'post': {
							'source': post.source,
							'uuid': post.uuid
						},
						'comment': theComment,
						'commentSummary': thePhoto.commentSummary,
						'commentCount': thePhoto.resolvedComments.length
					};

					if (view === '.json') {
						return res.send(utils.encryptIfFriend(friend, data));
					}

					var options = {
						'data': data,
						'user': currentUser,
						'friend': friend,
						'wantSummary': true
					};

					utils.renderFile('/components/rendered-comment.pug', options, req, function (err, html) {
						if (err) {
							return next(err);
						}
						return res.send(utils.encryptIfFriend(friend, html));
					});
				});
			});
		});
	});
	server.use(router);
};
