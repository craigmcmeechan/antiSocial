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
						'userId': friend.userId
					}]
				}
			}

			server.models.NewsFeedItem.findOne(query, function (err, oldNews) {
				if (err) {
					logger.error({
						'err': err,
						'query': query
					}, 'error reading NewsFeedItem item');
					return cb(err);
				}

				if (oldNews) {
					debugVerbose('old news %j', oldNews)
					return;
				};

				async.series([
					function createNewFeedItem(cb) {

						delete myNewsFeedItem.id;
						delete myNewsFeedItem.visibility;
						myNewsFeedItem.userId = friend.userId;
						myNewsFeedItem.friendId = friend.id;
						myNewsFeedItem.originator = false;

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
		}
	};
}
