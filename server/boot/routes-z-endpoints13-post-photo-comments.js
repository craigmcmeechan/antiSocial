// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');
var resolveProfiles = require('../lib/resolveProfiles');
var resolveComments = require('../lib/resolveComments');
var resolvePostPhotos = require('../lib/resolvePostPhotos');
var async = require('async');
var debug = require('debug')('proxy');
var utils = require('../lib/endpoint-utils');

var postPhotoCommentsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/photo\/([a-f0-9-]+)\/comments(\.json)?$/;

module.exports = function (server) {
	var router = server.loopback.Router();

	/**
	 * Retrieve the comments on a user's photo as HTML or JSON
	 * The comments being requested could be of a user's photo on the server or a
	 * friend of a user on the server. If the request is anonymous, only
	 * public information is returned. If the request is for HTML the
	 * response may include the user's photo's comments either public or, if the
	 * requestor is a friend, comments based on the visibility allowed for the
	 * requestor.
	 *
	 * @name Get comments for a user's post's photo as JSON object or as an HTML page
	 * @path {GET} /:username/post/:postId/photo/:photoId/comments[.json]
	 * @params {String} username Username of user on this server or a friend of the logged in user
	 * @params {String} postId Id of wanted post
	 * @params {String} photoId Id of wanted post
	 * @params {String} .json Append the .json suffix for JSON response otherwise HTML is returned
	 * @auth Anonymous, with valid user credentials or with valid friend credentials
	 * @header {String} friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records
	 * @header {Cookie} access_token Request made by a logged in user on this server (set when user logges in.)
	 * @response {JSON|HTML} If .json is requested returns an array of comment objects, otherwise HTML
	 */

	router.get(postPhotoCommentsRE, getCurrentUser(), checkNeedProxyRewrite('comments'), getFriendAccess(), function (req, res, next) {
		var ctx = req.myContext;
		var redirectProxy = ctx.get('redirectProxy');
		if (redirectProxy) {
			return next();
		}

		var matches = req.url.match(postPhotoCommentsRE);

		var username = matches[1];
		var postId = matches[2];
		var photoId = matches[3];
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

				utils.getPost(postId, user, friend, null, isMe, function (err, post) {
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

			// TODO kludge
			thePhoto.about = post.source + '/post/' + post.uuid;
			resolveComments([thePhoto], 'photo', isMe, function (err) {
				async.map(thePhoto.resolvedComments, resolveProfiles, function (err) {

					var data = {
						'pov': {
							'user': user.username,
							'isMe': isMe,
							'friend': friend ? friend.remoteUsername : false,
							'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
						},
						'post': post,
						'photo': thePhoto,
						'comments': thePhoto.resolvedComments,
						'about': post.source + '/post/' + post.uuid + '/photo/' + thePhoto.uuid
					};

					if (view === '.json') {
						return res.send(utils.encryptIfFriend(friend, data));
					}

					var options = {
						'data': data,
						'user': currentUser,
						'friend': friend
					};

					utils.renderFile('/components/rendered-comments.pug', options, req, function (err, html) {
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
