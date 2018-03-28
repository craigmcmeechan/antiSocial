var url = require('url');
var async = require('async');
var VError = require('verror').VError;
var encryption = require('./encryption');

var debug = require('debug')('feeds');
var debugWebsockets = require('debug')('websockets');

var connections = {};
module.exports.connections = connections;

module.exports.disconnectAll = function disconnectAll(server, user) {
	for (var key in connections) {
		var connection = connections[key];
		if (connection.currentUser.id === user.id) {
			connection.socket.close();
			connection.status = 'closed';
			debugWebsockets('watchFeed closed %s', connection.key);
			delete connections[key];
		}
	}
};

var disConnect = function disConnect(server, friend) {
	for (var key in connections) {
		var connection = connections[key];
		if (connection.friend.id === friend.id) {
			connection.socket.close();
			connection.status = 'closed';
			debugWebsockets('watchFeed disConnect %s closed', connection.key);
			delete connections[key];
		}
	}
};

module.exports.disConnect = disConnect;

module.exports.connectAll = function connectAll(server, user) {
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
			watchFeed(server, friend);
		}
	});
};


var watchFeed = function watchFeed(server, friend) {

	server.models.Friend.include([friend], 'user', function (err, instances) {

		var currentUser = friend.user();

		var key = currentUser.username + '<-' + friend.remoteEndPoint;

		if (connections[key] && connections[key].status === 'open') {
			debugWebsockets('watchFeed %s already listening ', key);
		}
		else {

			var remoteEndPoint = url.parse(friend.remoteEndPoint);
			var feed = remoteEndPoint.protocol + '//' + remoteEndPoint.host;

			var endpoint = remoteEndPoint.protocol === 'https' ? 'wss' : 'ws';
			endpoint += '://' + remoteEndPoint.host;

			endpoint += '?friend-access-token=' + friend.remoteAccessToken;
			if (friend.highWater) {
				endpoint += '&friend-high-water=' + friend.highWater;
			}
			var socket = require('socket.io-client')(endpoint);

			var connection = {
				'key': key,
				'endpoint': feed,
				'socket': socket,
				'currentUser': currentUser,
				'friend': friend,
				'status': 'closed'
			};
			connections[key] = connection;
			socket.emit('authentication', {
				'subscriptions': {
					'PushNewsFeedItem': ['after save']
				}
			});
			socket.on('authenticated', function () {
				debugWebsockets('watchFeed %s listening', key);
				socket.on('data', getListener(server, connection));
			});
			socket.on('connect', getOpenHandler(server, connection));
			socket.on('disconnect', getCloseHandler(server, connection));
		}
	});
};

function getOpenHandler(server, connection) {
	return function (e) {
		connection.status = 'open';
		debugWebsockets('watchFeed getOpenHandler %s %j ', connection.key, e);
	};
}

function getCloseHandler(server, connection) {
	return function (e) {
		connection.status = 'closed';
		debugWebsockets('watchFeed getCloseHandler %s %j', connection.key, e);
		delete connections[connection.key];
	};
}

function getErrorHandler(server, connection) {
	return function (e) {
		connection.status = 'error';
		debugWebsockets('watchFeed getErrorHandler %s %j', connection.key, e);
		delete connections[connection.key];
	};
}

function getListener(server, connection) {
	var friend = connection.friend;
	var currentUser = friend.user();

	return function (data) {

		var logger = server.locals.logger;

		var message = data;

		if (message.type === 'offline') {
			debugWebsockets('watchFeed listener %s received offline message', connection.key);
			connection.socket.close();
			connection.status = 'closed';
			delete connections[connection.key];
			return;
		}

		if (message.type === 'online') {
			debugWebsockets('watchFeed listener %s received online message', connection.key);
			return;
		}

		if (message.type === 'heartbeat') {
			debugWebsockets('watchFeed listener %s received heartbeat', connection.key);
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
					debug('watchFeed listener ' + currentUser.username + ' skipping old news %j %j', oldNews);
					return;
				}
				else if (message.type === 'update' || message.type === 'backfill') {
					debug('watchFeed listener ' + currentUser.username + ' updating old news %j %j', oldNews, myNewsFeedItem);
					oldNews.details = myNewsFeedItem.details;
					oldNews.versions = myNewsFeedItem.versions;
					oldNews.deleted = myNewsFeedItem.deleted;
					oldNews.tags = myNewsFeedItem.tags;
					oldNews.save();

					// cleanup all my interations with this item
					if (myNewsFeedItem.deleted) {
						async.series([
							function updateNewsFeedItem(cb) {
								server.models.NewsFeedItem.destroyAll({
									'and': [{
										'userId': currentUser.id
									}, {
										'about': {
											'like': new RegExp('^' + myNewsFeedItem.about)
										}
									}]
								}, function (err, data) {
									cb(err);
								});
							},
							function updatePushNewsFeedItem(cb) {
								var q = {
									'where': {
										'and': [{
											'about': {
												'like': new RegExp('^' + myNewsFeedItem.about)
											}
										}, {
											'userId': currentUser.id
										}]
									}
								};

								server.models.PushNewsFeedItem.find(q, function (err, items) {
									for (var i = 0; i < items.length; i++) {
										items[i].updateAttribute('deleted', true);
									}
									cb(err);
								});
							}
						], function (err) {
							return;
						});
					}
				}
				else {
					debug('watchFeed listener ' + currentUser.username + ' skipping old news unknown type %s %j %j', message.type, oldNews, myNewsFeedItem);
					return;
				}
			}
			else { // not old news
				if (message.type === 'update') {
					debug('watchFeed listener ' + currentUser.username + ' received update but NewsFeedItem not found %j', message);
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
						],
						function (e) {
							if (e) {
								logger.error({
									err: e
								}, 'error processing newsfeed');
							}
							return;
						});
				});
			}
		});
	};
}

module.exports.connect = watchFeed;
