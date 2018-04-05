var async = require('async');
var uuid = require('uuid');
var VError = require('verror').VError;
var FB = require('fb');
var resolvePostPhotos = require('./resolvePostPhotos');
var server = require('../server')

module.exports = function doPostNotifications(currentUser, post, done) {
	async.waterfall([
			function makePushNewsFeedItem(cb) { // tell the world
				if (!post.posted) {
					return async.setImmediate(function () {
						cb(null, null, post);
					});
				}

				currentUser.pushNewsFeedItems.create({
					'uuid': post.uuid,
					'type': 'post',
					'source': server.locals.config.publicHost + '/' + currentUser.username,
					'about': server.locals.config.publicHost + '/' + currentUser.username + '/post/' + post.uuid,
					'target': post.about,
					'visibility': post.visibility,
					'details': {},
					'tags': post.tags
				}, function (err, news) {
					if (err) {
						var e = new VError(err, 'could push news feed');
						return cb(e);
					}
					cb(null, news, post);
				});
			},
			function makeNewsFeedItem(news, post, cb) { // notify self

				var now = new Date();

				var query = {
					'where': {
						'and': [{
							'userId': currentUser.id
						}, {
							'uuid': post.uuid,
						}]
					}
				};

				var pendingItem = {
					'uuid': post.uuid,
					'type': 'post',
					'source': server.locals.config.publicHost + '/' + currentUser.username,
					'about': server.locals.config.publicHost + '/' + currentUser.username + '/post/' + post.uuid,
					'target': post.about,
					'visibility': post.visibility,
					'tags': post.tags,
					'createdOn': now,
					'updatedOn': now,
					'userId': currentUser.id,
					'details': {}
				};

				server.models.NewsFeedItem.findOrCreate(query, pendingItem, function (err, item) {
					if (err) {
						var e = new VError(err, 'could not save NewsFeedItem');
						return cb(e);
					}
					item.save();
					cb(err, post);
				});
			},
			function crossPostFacebook(post, cb) {
				if (!post.posted || !fbIdentity || post.visibility.indexOf('facebook') === -1) {
					return async.setImmediate(function () {
						cb(null, post);
					});
				}

				var fbIdentity;
				var twIdentity;
				if (currentUser.identities()) {
					for (var i = 0; i < currentUser.identities().length; i++) {
						var identity = currentUser.identities()[i];
						if (identity.provider === 'facebook') {
							fbIdentity = identity;
						}
						if (identity.provider === 'twitter') {
							twIdentity = identity;
						}
					}
				}

				resolvePostPhotos([post], function (err) {

					var fb = new FB.Facebook({
						'appId': process.env.FACEBOOK_CLIENT_ID,
						'appSecret': process.env.FACEBOOK_CLIENT_SECRET,
						'accessToken': fbIdentity.credentials.token
					});

					var body = '';
					var links = [];

					if (post.visibility.indexOf('public') !== -1) {
						// pass the permilink of the post to facebook and let it build the preview
						links = [server.locals.config.publicHost + '/' + currentUser.username + '/post/' + post.uuid];
					}
					else {
						// try to adapt the post to facebook limitations
						body = post.body;

						// extract first link
						links = post.body.match(/^(http[^\s\b]*)/gm);
						if (links) {
							body = body.replace(/^(http[^\s\b]*)/gm, '');
						}

						// strip all other markup
						body = server.locals.marked(body);
						body = body.replace(/<[^>]+>/g, '');

						// if there are photos... attach the first one
						if (post.sortedPhotos && post.sortedPhotos.length) {
							var imageSet = post.sortedPhotos[0].uploads()[0].imageSet;
							var image;
							if (imageSet.large) {
								image = imageSet.large.url;
							}
							else {
								image = imageSet.original.url;
							}
							links = [image];
						}
					}

					fb.api(
						'/me/feed',
						'POST', {
							'message': body,
							'link': links.length ? links[0] : null
						},
						function (response) {
							if (response && response.error) {
								var e = new VError(response.error, 'post saved but could cross post to facebook');
								return cb(e);
							}
							cb(null, post);
						}
					);
				});
			}
		],
		function (err, post) {
			done(err, post);
		});
};

/*
server.models.Friend.findOne({
	'where': {
		'remoteEndPoint': friendEndPoint
	}
}, function (err, friend) {
	currentUser.pushNewsFeedItems.create({
		'uuid': uuid(),
		'type': 'tag',
		'source': server.locals.config.publicHost + '/' + currentUser.username,
		'about': server.locals.config.publicHost + '/' + currentUser.username + '/post/' + post.uuid,
		'target': friend.remoteEndPoint,
		'visibility': post.visibility,
		'details': {},
		'tags': post.tags
	}, function (err, news) {
		if (err) {
			var e = new VError(err, 'could push news feed');
			return doneTag(e);
		}
		doneTag(null);
	});
});
*/
