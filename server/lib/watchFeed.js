/*

PushNewsFeedItems are used to propagate notifications through friend networks
	"michael created a new post"
	"michael posted to my wall"
	"michael liked a post by me"

NewsFeedItems is used to aggregate news about me and my items from the
PushNewsFeedItems of my friends - server side feed watchers make MyNewsFeedItem
items based on feeds they are watching to notify users of activity in their
network that is of interest to them.

	"michael likes my post"
	"michael created a new post"
	"michael shared a post on my wall"

Michael's and my servers starts watching changes to each other's
PushNewsFeedItems. Was going to optimize to one connection per server but
probably need to do it one to one so that access-tokens can be exchanged
and the feed filtered by audience permissions.

Michael does something > create a PushNewsFeedItem

I do something > create a PushNewsFeedItem

My server receives notification of new PushNewsFeedItems initiated by Michael

	figure out the context of these items and how they relate to me and my posts. Is
	it about me or something I posted or a post I am watching (a post I liked or
	commented on) if so is it also of interest to my followers?

	"Michael created a post"
	-> only of interest to me. Create a NewsFeedItems item with reference to
	post so I can see it in my newsfeed

	"Michael liked a post by xxx"
	"Michael commented on a post by xxx"
	-> of interest to me but not my followers. Create a NewsFeedItems with
	reference to post so I can see it in my newsfeed

	"Michael liked my post"
	"Michael commented on my post"
	-> also of interest to my network, create a NewsFeedItems to propigate and
	create a PushNewsFeedItem to notify my followers

*/

// watch friend's push feeds for items of interest (need a closure for this so we can see the friend in the callback)

var es = require('eventsource');
var url = require('url');
var async = require('async');
var resolveProfiles = require('./resolveProfiles');
var VError = require('verror').VError;
var WError = require('verror').WError;
var encryption = require('./encryption');


var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');

var listeners = {};

module.exports = function watchFeed(server, friend) {

	var remoteEndPoint = url.parse(friend.remoteEndPoint);
	var feed = remoteEndPoint.protocol + '//' + remoteEndPoint.host + '/api/PushNewsFeedItems' + remoteEndPoint.pathname + '/stream-updates';

	server.models.Friend.include([friend], 'user', function (err, instances) {

		debugVerbose('watchFeed', friend);

		var key = friend.user().username + ' <- ' + feed;

		if (listeners[key]) {
			debug('already listening', friend);
		}
		else {
			debug('EventSource listening ' + key);
			listeners[key] = new es(feed, {
				headers: {
					'friend-access-token': friend.remoteAccessToken,
					'friend-high-water': friend.highWater
				}
			});
			listeners[key].addEventListener('data', getListener(server, friend));
			listeners[key].addEventListener('error', listenError);
			listeners[key].addEventListener('close', listenError);
		}
	});
};

function listenError(e) {
	debug(e);
}

function getListener(server, friend) {

	return function (e) {
		debugVerbose('listener received:', e);

		var logger = server.locals.logger;

		if (e.type === 'data') {
			var message = JSON.parse(e.data);

			var privateKey = friend.keys.private;
			var publicKey = friend.remotePublicKey;

			var toDecrypt = message.data;
			var sig = message.sig;
			var pass = message.pass;

			var decrypted = encryption.decrypt(publicKey, privateKey, toDecrypt, pass, sig);

			if (!decrypted.valid) { // could not validate signature
				logger.error('WatchNewsFeedItem decryption signature validation error %j', message);
				return;
			}

			message.data = JSON.parse(decrypted.data);

			resolveProfiles(message.data, function (err) {

				var myNewsFeedItem = JSON.parse(JSON.stringify(message.data));

				delete myNewsFeedItem.id;
				delete myNewsFeedItem.visibility;
				myNewsFeedItem.userId = friend.userId;
				myNewsFeedItem.friendId = friend.id;

				//console.log('item %j',myNewsFeedItem);

				var sourceProfile = myNewsFeedItem.resolvedProfiles[myNewsFeedItem.source];
				var aboutProfile = myNewsFeedItem.resolvedProfiles[myNewsFeedItem.about];

				var reactionData;
				var commentData;

				var myEndPoint = server.locals.config.publicHost + '/' + friend.user().username;
				var whoAbout = message.data.about.replace(/\/post\/.*$/, '');

				var saveIt = false;

				if (message.data.type === 'new friend') {
					debug(message.data.source + ' and ' + message.data.about + ' are now friends');

					myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
					myNewsFeedItem.humanReadable += '<a href="/profile?endpoint=' + encodeURIComponent(message.data.source) + '">' + sourceProfile.profile.name + '</a>';
					if (whoAbout === myEndPoint) {
						myNewsFeedItem.humanReadable += ' accepted.';
					}
					else {
						myNewsFeedItem.humanReadable += ' added <a href="/profile?endpoint=' + encodeURIComponent(message.data.about) + '">' + aboutProfile.profile.name + '</a>';
					}
					saveIt = true;
				}

				if (message.data.type === 'new comment') {
					var author = message.data.details.postAuthorName;

					var postDesc = 'this post';

					if (whoAbout === myEndPoint) {
						postDesc = 'my post';
						commentData = {
							'uuid': message.data.uuid,
							'source': message.data.source,
							'about': message.data.about,
							'body': message.data.details.body,
							'details': {}
						};
						debugVerbose('saving comment', commentData);
					}

					debug('my friend "' + sourceProfile.profile.name + '" commented on ' + message.data.about);
					myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
					myNewsFeedItem.humanReadable += '<a href="/profile?endpoint=' + encodeURIComponent(message.data.source) + '">' + sourceProfile.profile.name + '</a>';
					myNewsFeedItem.humanReadable += ' commented on <a href="/post?endpoint=' + encodeURIComponent(message.data.about) + '">' + postDesc + '</a>';

					myNewsFeedItem.details = {
						'rendered': '<div class="comment"><a href="/profile?endpoint=' + encodeURIComponent(message.data.source) + '"><img class="profile-thumb" src="' + sourceProfile.profile.photo.url + '"><span class="profile-link">' + sourceProfile.profile.name + '</span></a>' + server.locals.marked(message.data.details.body) + '</div>'
					};

					saveIt = true;
				}

				if (message.data.type === 'react') {
					var author = message.data.details.postAuthorName;
					if (whoAbout === myEndPoint) {
						author = 'me';
						reactionData = {
							'uuid': message.data.uuid,
							'source': message.data.source,
							'about': message.data.about,
							'reaction': message.data.details.reaction,
							'details': {}
						};
						debugVerbose('saving reaction', reactionData);
					}

					var reaction = '<span class="em em-' + message.data.details.reaction + '"></span>';

					debug('my friend "' + sourceProfile.profile.name + '" liked ' + author);
					myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
					myNewsFeedItem.humanReadable += '<a href="/profile?endpoint=' + encodeURIComponent(friend.remoteEndPoint) + '">' + sourceProfile.profile.name + '</a>';
					myNewsFeedItem.humanReadable += ' ' + reaction + ' <a href="/post?endpoint=' + encodeURIComponent(message.data.about) + '">this post</a> by ' + aboutProfile.profile.name + '.';
					saveIt = true;
				}

				if (message.data.type === 'new post') {
					if (message.data.target === myEndPoint) {
						debug('my friend "' + sourceProfile.profile.name + '" posted ' + message.data.about + ' to my wall');
					}
					else {
						debug('my friend "' + sourceProfile.profile.name + '" posted ' + message.data.about);
					}
					myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
					myNewsFeedItem.humanReadable += '<a href="/profile?endpoint=' + encodeURIComponent(friend.remoteEndPoint) + '">' + sourceProfile.profile.name + '</a>';
					myNewsFeedItem.humanReadable += ' posted <a href="/post?endpoint=' + encodeURIComponent(message.data.about) + '">this</a>';
					if (message.data.target === myEndPoint) {
						myNewsFeedItem.humanReadable += ' on my wall';
					}
					saveIt = true;
				}

				var postId;
				var post;

				async.series([
					function createNewFeedItem(cb) {

						if (!saveIt) {
							return cb();
						}

						delete myNewsFeedItem.resolvedProfiles;

						server.models.NewsFeedItem.create(myNewsFeedItem, function (err, item) {
							if (err) {
								logger.error('error saving NewsFeedItem item', myNewsFeedItem);
								return cb(err);
							}
							cb();
						});
					},
					function findComment(cb) {
						if (!commentData && !reactionData) {
							return cb();
						}

						var postuuid = message.data.about.replace(/^.*\/post\//, '');
						var findComment = {
							'where': {
								'and': [{
									'userId': friend.user().id
								}, {
									'uuid': postuuid
								}]
							},
							'include': ['photos']
						};

						server.models.Post.findOne(findComment, function (err, foundPost) {
							if (err || !foundPost) {
								var e = new VError(err, 'error finding Comment %j', findComment);
								return cb(e);
							}
							post = foundPost;
							postId = post.id;
							cb();
						});
					},
					function createComment(cb) {

						if (!commentData) {
							return cb();
						}

						var photoId = myNewsFeedItem.details.photoId;

						if (photoId) {
							var thePhoto;
							for (var i = 0; i < post.photos().length; i++) {
								var photo = post.photos()[i];
								if (photo.uuid === photoId) {
									thePhoto = photo;
									break;
								}
							}
							if (thePhoto) {
								commentData.foreignId = thePhoto.id;
								commentData.foreignType = 'Photo';
							}
							else {
								return cb();
							}
						}
						else {
							commentData.foreignId = postId;
							commentData.foreignType = 'Post';
						}

						commentData.foreignId = photoId ? photoId : postId;
						commentData.foreignType = photoId ? 'Photo' : 'Post';

						server.models.Comment.create(commentData, function (err, item) {
							if (err) {
								logger.error('error saving Comment', commentData);
								return cb(err);
							}
							cb();
						});
					},
					function createReaction(cb) {

						if (!reactionData) {
							return cb();
						}

						var photoId = myNewsFeedItem.details.photoId;

						if (photoId) {
							var thePhoto;
							for (var i = 0; i < post.photos().length; i++) {
								var photo = post.photos()[i];
								if (photo.uuid === photoId) {
									thePhoto = photo;
									break;
								}
							}
							if (thePhoto) {
								reactionData.foreignId = thePhoto.id;
								reactionData.foreignType = 'Photo';
							}
							else {
								return cb();
							}
						}
						else {
							reactionData.foreignId = post.id;
							reactionData.foreignType = 'Post';
						}

						var query = {
							'and': [{
								'source': reactionData.source
							}, {
								'about': reactionData.about
							}]
						};

						debugVerbose('saving reaction %j %j', query, reactionData);

						server.models.Reaction.upsertWithWhere(query, reactionData, function (err, item) {
							if (err) {
								logger.error('error saving Reaction', reactionData);
								return cb(err);
							}
							cb();
						});
					},
					function updateHighwater(cb) {

						debug('saving highwater %j', message.data.createdOn);

						friend.updateAttributes({
							'highWater': message.data.createdOn
						}, function (err, updated) {
							if (err) {
								logger.error('error saving highwater %j', err);
								return cb(err);
							}
							cb();
						});
					}
				], function (e) {
					if (e) {
						logger.error('error processing newsfeed %j', e);
					}
					return;
				});
			});
		}
	};
}
