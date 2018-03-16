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
var server = require('../../server/server');


var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');

var connections = {};
module.exports.connections = connections;

module.exports.disconnectAll = function disconnectAll(user) {
	for (var key in connections) {
		var connection = connections[key];
		if (connection.currentUser.id === user.id) {
			connection.eventSource.close();
			connection.status = 'closed';
		}
	}
};

var disConnect = function disConnect(friend) {
	for (var key in connections) {
		var connection = connections[key];
		if (connection.friend.id === friend.id) {
			connection.eventSource.close();
			connection.status = 'closed';
		}
	}
};

module.exports.disConnect = disConnect;

module.exports.connectAll = function connectAll(user) {
	// poll friends feeds
	var query = {
		'where': {
			'and': [{
				'userId': user.id
			}, {
				'status': 'accepted'
			}]
		}
	};

	server.models.Friend.find(query, function (err, friends) {
		if (err) {
			console.log('Friend.find failed', err);
			return;
		}

		for (var i = 0; i < friends.length; i++) {
			var friend = friends[i];
			watchFeed(friend);
		}
	});
};


var watchFeed = function watchFeed(friend) {

	var remoteEndPoint = url.parse(friend.remoteEndPoint);
	var feed = remoteEndPoint.protocol + '//' + remoteEndPoint.host + '/api/PushNewsFeedItems' + remoteEndPoint.pathname + '/stream-updates';

	server.models.Friend.include([friend], 'user', function (err, instances) {

		debugVerbose('watchFeed', friend);

		var currentUser = friend.user();

		var key = currentUser.username + ' <- ' + feed;

		if (connections[key] && connections[key].status === 'open') {
			debug('watchFeed ' + currentUser.username + ' already listening ' + key);
		}
		else {
			debug('watchFeed ' + currentUser.username + ' listening ' + key);
			var eventSource = new es(feed, {
				headers: {
					'friend-access-token': friend.remoteAccessToken,
					'friend-high-water': friend.highWater
				}
			});

			var connection = {
				'key': key,
				'endpoint': feed,
				'eventSource': eventSource,
				'currentUser': currentUser,
				'friend': friend,
				'status': 'closed'
			};
			connections[key] = connection;

			eventSource.addEventListener('open', getOpenHandler(server, connection));
			eventSource.addEventListener('data', getListener(server, connection));
			eventSource.addEventListener('error', getErrorHandler(server, connection));
			eventSource.addEventListener('close', getCloseHandler(server, connection));
		}
	});
};

function getOpenHandler(server, connection) {
	return function (e) {
		connection.status = 'open';
		debug('watchFeed eventsource open %j user %s watching %s', e, connection.currentUser.username, connection.endpoint);
	};
}

function getCloseHandler(server, connection) {
	return function (e) {
		connection.status = 'closed';
		debug('watchFeed eventsource close %j user %s watching %s', e, connection.currentUser.username, connection.endpoint);
	};
}

function getErrorHandler(server, connection) {
	return function (e) {
		connection.status = 'error';
		debug('watchFeed error %j user %s watching %s', e, connection.currentUser.username, connection.endpoint);
	};
}

function getListener(server, connection) {
	var friend = connection.friend;
	var currentUser = friend.user();

	return function (e) {
		debugVerbose('listener ' + currentUser.username + ' received:', e);

		var logger = server.locals.logger;

		if (e.type === 'data') {
			var message = JSON.parse(e.data);

			if (message.type === 'offline') {
				debug('listener ' + currentUser.username + ' received offline message ' + connection.key);
				connection.eventSource.close();
				connection.status = 'closed';
				return;
			}

			if (message.type === 'online') {
				debug('listener ' + currentUser.username + ' received online message ' + connection.key);
				return;
			}

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
					if (message.type === 'create') {
						debug('watchFeed ' + currentUser.username + ' skipping old news %j %j', oldNews);
						return;
					}

					if (message.type === 'update' || message.type === 'backfill') {
						debug('watchFeed ' + currentUser.username + ' updating old news %j %j', oldNews, myNewsFeedItem);
						oldNews.details = myNewsFeedItem.details;
						oldNews.versions = myNewsFeedItem.versions;
						oldNews.deleted = myNewsFeedItem.deleted;
						oldNews.save();
						return;
					}

					debug('watchFeed ' + currentUser.username + ' skipping old news unknown type %s %j %j', message.type, oldNews, myNewsFeedItem);
					return;
				}
				else {
					if (message.type === 'update') {
						debug('watchFeed ' + currentUser.username + ' received update but NewsFeedItem not found %j', message);
					}
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

					if (!found.length && !isMe) {
						debug('watchFeed ' + currentUser.username + ' ' + server.locals.config.publicHost + '/' + currentUser.username + 'meh. not interested in stuff about ' + whoAbout);
						return;
					}

					async.series([
						function createNewFeedItem(cb) {

							delete myNewsFeedItem.id;
							delete myNewsFeedItem.visibility;
							myNewsFeedItem.userId = currentUser.id;
							myNewsFeedItem.friendId = friend.id;

							debug('watchFeed ' + currentUser.username + ' create NewsFeedItem %j', myNewsFeedItem);

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

							debug('watchFeed ' + currentUser.username + ' saving highwater %j', message.data.createdOn);

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

module.exports.connect = watchFeed;
