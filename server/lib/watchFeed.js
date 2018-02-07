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

My server receives notification of new PushNewsFeedItems initiated by My Friends
and caches them in NewsFeedItems.

*/

// watch friend's push feeds for items of interest (need a closure for this so we can see the friend in the callback)

var es = require('eventsource');
var url = require('url');
var async = require('async');
var uuid = require('uuid');
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

		var currentUser = friend.user();

		var key = currentUser.username + ' <- ' + feed;

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
	var currentUser = friend.user();

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
				logger.error({
					'message': message
				}, 'WatchNewsFeedItem decryption signature validation error');
				return;
			}

			message.data = JSON.parse(decrypted.data);

			var myNewsFeedItem = JSON.parse(JSON.stringify(message.data));

			var query = {
				'where': {
					'and': [{
						'uuid': myNewsFeedItem.uuid
					}, {
						'userId': currentUser.id
					}]
				}
			};

			server.models.NewsFeedItem.findOne(query, function (err, oldNews) {
				if (err) {
					logger.error({
						'err': err,
						'query': query
					}, 'error reading NewsFeedItem item');
					return;
				}

				if (oldNews) {
					debugVerbose('old news %j', oldNews);
					return;
				}

				var about = myNewsFeedItem.about;
				var whoAbout = about.replace(/\/(post|photo)\/.*$/, '');
				var isMe = false;
				if (whoAbout === server.locals.config.publicHost + '/' + currentUser.username) {
					isMe = true;
				}

				var filter = {
					'where': {
						'or': [{
							'remoteEndPoint': whoAbout
						}]
					}
				};

				if (myNewsFeedItem.target) {
					filter.where.or.push({
						'remoteEndPoint': myNewsFeedItem.target
					});
				}

				server.models.Friend.find(filter, function (err, found) {
					if (err) {
						logger.error({
							err: err
						}, 'error finding friends');
						return;
					}

					if (!found || !isMe) {
						//console.log(server.locals.config.publicHost + '/' + currentUser.username + 'meh. not interested in stuff about ' + whoAbout);
						return;
					}

					async.series([
						function createNewFeedItem(cb) {

							delete myNewsFeedItem.id;
							delete myNewsFeedItem.visibility;
							myNewsFeedItem.userId = currentUser.id;
							myNewsFeedItem.friendId = friend.id;

							server.models.NewsFeedItem.create(myNewsFeedItem, function (err, item) {
								if (err) {
									logger.error({
										'myNewsFeedItem': myNewsFeedItem
									}, 'error saving NewsFeedItem item');
									return cb(err);
								}
								cb();
							});
						},
						function notifyNetwork(cb) {
							// somebody posted to my wall
							if (!message.data.target || message.data.type !== 'post' || message.data.target !== server.locals.config.publicHost + '/' + currentUser.username) {
								return process.nextTick(function () {
									cb();
								});
							}

							async.waterfall([
								function (cbPostOnMyWall) { // make a Post record
									var post = {
										'uuid': message.data.uuid,
										'athoritativeEndpoint': message.data.about,
										'source': message.data.source,
										'userId': currentUser.id,
										'visibility': message.data.visibility
									};

									server.models.Post.create(post, function (err, post) {
										if (err) {
											var e = new VError(err, 'could create Post');
											return cbPostOnMyWall(e);
										}
										cbPostOnMyWall(null, post);
									});
								},
								function (post, cbPostOnMyWall) { // make a PushNewsFeed record
									server.models.PushNewsFeedItem.create({
										'uuid': message.data.uuid,
										'type': 'post',
										'source': server.locals.config.publicHost + '/' + currentUser.username,
										'about': server.locals.config.publicHost + '/' + currentUser.username + '/post/' + post.uuid,
										'visibility': post.visibility,
										'details': {},
										'userId': currentUser.id
									}, function (err, news) {
										if (err) {
											var e = new VError(err, 'could push news feed');
											return cb(e);
										}
										cbPostOnMyWall(null);
									});
								}

							], function (err) {
								cb(err);
							});
						},
						function updateHighwater(cb) {

							debug('saving highwater %j', message.data.createdOn);

							friend.updateAttributes({
								'highWater': message.data.createdOn
							}, function (err, updated) {
								if (err) {
									logger.error({
										err: err
									}, 'error saving highwater');
									return cb(err);
								}
								cb();
							});
						}
					], function (e) {
						if (e) {
							logger.error({
								err: e
							}, 'error processing newsfeed');
						}
						return;
					});
				});
			});
		}
	};
}
