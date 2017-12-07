var getFriendAccess = require('../middleware/context-getFriendAccess');
var getCurrentUser = require('../middleware/context-currentUser');
var getFriendForEndpoint = require('../middleware/context-getFriendForEndpoint');
var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');

var VError = require('verror').VError;
var WError = require('verror').WError;
var request = require('request');

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/photo', getCurrentUser(), getFriendForEndpoint(), function (req, res, next) {
		var ctx = req.myContext;
		var endpoint = req.query.endpoint;
		var photo = req.query.photo;
		var currentUser = ctx.get('currentUser');
		var friend = ctx.get('isFriend');
		var matches;

		matches = endpoint.match(/\/post\/([a-f0-9\-]+)/);
		var postId = matches[1];

		var whoAbout = endpoint.replace(/\/post\/.*$/, '');

		// check if endpoint is me
		if (currentUser) {
			var myEndPoint = server.locals.config.publicHost + '/' + currentUser.username;
			if (whoAbout === myEndPoint) {
				endpoint = null;
			}
		}

		if (!endpoint) {
			getPhoto(currentUser.username, postId, photo, friend, req, function (err, post, photo) {
				if (err) {
					var e = new WError(err, 'getPhoto failed');
					debug(e.toString());
					debug(e.stack);
					return res.sendStatus(500, e.toString());
				}

				if (!photo) {
					return res.sendStatus(404);
				}

				resolveProfilesForPosts([post, photo],
					function (err) {
						res.render('components/post-photo-reactions-and-comments', {
							'user': currentUser,
							'post': post,
							'photo': photo
						});
					});
			});
		}
		else {
			// get it from the remote endpoint
			var options = {
				'url': endpoint + '/photo/' + photo,
				'json': true,
				headers: {
					'friend-access-token': friend ? friend.remoteAccessToken : ''
				}
			};

			console.log('getting photo', options);

			request.get(options, function (err, response, body) {
				if (err) {
					var e = new VError(err, 'could not load endpoint');
					debug(e.message, options);
					return next(e);
				}

				if (response.statusCode !== 200) {
					return res.sendStatus(response.statusCode);
				}

				resolveProfilesForPosts([body.post, body.photo],
					function (err) {
						res.send(body);
					});
			});
		}
	});


	var postPhotoRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)$/;
	router.get(postPhotoRE, getFriendAccess(), function (req, res, next) {
		var ctx = req.myContext;
		var matches = req.url.match(postPhotoRE);
		var username = matches[1];
		var postId = matches[2];
		var photoId = matches[3];
		var friend = ctx.get('friendAccess');

		getPhoto(username, postId, photoId, friend, req, function (err, post, photo) {
			if (err) {
				return next(err);
			}

			if (!photo) {
				return res.sendStatus(404);
			}

			res.send({
				'post': post,
				'photo': photo
			});
		});
	});

	function getPhoto(username, postId, photoId, friend, req, done) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		req.app.models.MyUser.findOne({
			'where': {
				'username': username
			},
			'include': ['uploads']
		}, function (err, user) {

			if (err || !user) {
				return done();
			}

			var query = {
				'where': {
					'and': [{
						'uuid': postId
					}, {
						'userId': user.id
					}]
				},
				'order': 'createdOn DESC',
				'limit': 30,
				'include': [{
					'photos': ['uploads']
				}]
			};

			if (!currentUser || currentUser.id.toString() !== user.id.toString()) {
				query.where.and.append({
					'visibility': {
						'inq': friend && friend.audiences ? friend.audiences : ['public']
					}
				});
			}

			req.app.models.Post.findOne(query, function (err, post) {
				if (err) {
					var e = new VError(err, 'could not find post');
					debug(e.message, query);
					return done(e);
				}

				if (!post) {
					return done();
				}

				var photos = post.photos()
				var thePhoto = null;
				for (var i = 0; i < photos.length; i++) {
					if (photos[i].uuid === photoId) {
						thePhoto = photos[i];
					}
				}

				if (!thePhoto) {
					return done();
				}

				return done(null, post, thePhoto);
			});
		});
	};

	server.use(router);
};
