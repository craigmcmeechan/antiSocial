/*

Notifications happen through updates to 2 tables
	PushNewsFeedItem: announcements that propagate through the friend network
		Updated when things are created or changed.
		Eg: I posted something, I commented on something, I reacted to something.

	NewsFeedItem: user cache of applicable events from their POV
		Used to build "news feed" for user
		Eg: I posted something, My friend xxx posted something, Someone reacted to someone elses post

Users watch all their friends PushNewsFeedItem feeds for changes. When a friend
starts listenting they are sent all PushNewsFeedItems that have been modified
since they last connected. While they are listenting they are sent changes in real time.

When you creates a post, reaction or a comment
	Make an entry in PushNewsFeedItems
When you modify a post, reaction or a comment
	Update the entry in PushNewsFeedItem
When you delete a post or a comment
	Mark then entry in PushNewsFeedItem as deleted=true

PushNewsFeedItems events are filtered based on friend visibility permisions.
	if the PushNewsFeedItem is being created and it is visible to the listenting friend
		Send a 'create' event
	if the PushNewsFeedItem is being updated
		if is not visible to the listenting friend
			Send a 'remove' event (allow them to remove it from their cache
			it was formally visible)
		else
			Send an update event

The listening friend updates their local NewsFeedItem database when events in their
friends PushNewsFeedItems are receieved
	If it's a create event, create a NewsFeedItem
	If it's a remove, destroy the NewsFeedItem
	If it's an update
		if it exists, update the existing NewsFeedItem
		else create it again (edge case - was visible to me, then not, then was again)

Notes:
	PushNewsFeedItems are never deleted - they are marked as deleted so backfilling
	can occur to offline friends.

*/

var url = require('url');
var async = require('async');
var VError = require('verror').VError;
var encryption = require('./encryption');
var utils = require('./utilities');
var mailer = require('./mail');
var debug = require('debug')('feeds');
var debugWebsockets = require('debug')('websockets');

var watchFeedConnections = {};
module.exports.watchFeedConnections = watchFeedConnections;

module.exports.disconnectAll = function disconnectAll(server, user) {
	for (var key in watchFeedConnections) {
		var connection = watchFeedConnections[key];
		if (connection.currentUser.id.toString() === user.id.toString()) {
			connection.socket.close();
			//connection.status = 'closed';
			debugWebsockets('watchFeed closed %s', connection.key);
			//delete watchFeedConnections[key];
		}
	}
};

var disConnect = function disConnect(server, friend) {
	for (var key in watchFeedConnections) {
		var connection = watchFeedConnections[key];
		if (connection.friend.id.toString() === friend.id.toString()) {
			connection.socket.close();
			debugWebsockets('watchFeed disConnect %s closed', connection.key);
			//connection.status = 'closed';
			//delete watchFeedConnections[key];
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

		if (watchFeedConnections[key] && watchFeedConnections[key].status === 'open') {
			debugWebsockets('watchFeed %s already listening ', key);
		}
		else {

			var remoteEndPoint = url.parse(friend.remoteEndPoint);
			var feed = remoteEndPoint.protocol + '//' + remoteEndPoint.host;

			var endpoint = remoteEndPoint.protocol === 'https:' ? 'wss' : 'ws';
			endpoint += '://' + remoteEndPoint.host;

			debugWebsockets('watchFeed %s %s connecting %s', key, remoteEndPoint.protocol, endpoint);

			// if connecting to ourself behind a proxy don't use publicHost
			if (process.env.BEHIND_PROXY === "true") {
				var rx = new RegExp('^' + server.locals.config.websockets);
				if (endpoint.match(rx)) {
					endpoint = endpoint.replace(server.locals.config.websockets, 'ws://localhost:' + server.locals.config.port);
					debug('bypass proxy ' + endpoint);
				}
			}

			var socket = require('socket.io-client')(endpoint, {});

			var connection = {
				'key': key,
				'endpoint': feed,
				'socket': socket,
				'currentUser': currentUser,
				'friend': friend,
				'status': 'closed'
			};
			watchFeedConnections[key] = connection;
			socket.emit('authentication', {
				'friendAccessToken': friend.remoteAccessToken,
				'friendHighWater': friend.highWater,
				'subscriptions': {
					'PushNewsFeedItem': ['after save']
				}
			});
			socket.on('authenticated', function () {
				debugWebsockets('watchFeed %s authenticated', key);
				socket.on('data', getListener(server, connection));
			});
			socket.on('connect', getOpenHandler(server, connection));
			socket.on('disconnect', getCloseHandler(server, connection));
			socket.on('error', getErrorHandler(server, connection));
		}
	});
};

function getOpenHandler(server, connection) {
	return function openHandler(e) {
		connection.status = 'open';
		debugWebsockets('watchFeed openHandler %s', connection.key);
	};
}

function getCloseHandler(server, connection) {
	return function closeHandler(e) {
		connection.status = 'closed';
		debugWebsockets('watchFeed closeHandler %s because %j', connection.key, e);
		//delete watchFeedConnections[connection.key];
		setTimeout(function () {
			watchFeed(server, connection.friend);
		}, 5000);
	};
}

function getErrorHandler(server, connection) {
	return function errorHandler(e) {
		connection.status = 'error';
		debugWebsockets('watchFeed errorHandler %s %j', connection.key, e);
		//delete watchFeedConnections[connection.key];
	};
}

function getListener(server, connection) {
	var friend = connection.friend;
	var currentUser = friend.user();

	return function listener(data) {

		var logger = server.locals.logger;

		var message = data;

		if (message.type === 'offline') {
			debugWebsockets('watchFeed listener %s received offline message', connection.key);
			connection.socket.close();
			//connection.status = 'closed';
			//delete watchFeedConnections[connection.key];
			return;
		}

		if (message.type === 'online') {
			debugWebsockets('watchFeed listener %s received online message', connection.key);
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
					'type': myNewsFeedItem.type
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
				else if (message.type === 'remove') {
					oldNews.destroy();
					return;
				}
				else if (message.type === 'update' || message.type === 'backfill') {
					debug('watchFeed listener ' + currentUser.username + ' updating old news %j %j', oldNews, myNewsFeedItem);
					oldNews.details = myNewsFeedItem.details;
					oldNews.versions = myNewsFeedItem.versions;
					oldNews.deleted = myNewsFeedItem.deleted;
					oldNews.tags = myNewsFeedItem.tags;
					oldNews.save();

					if (myNewsFeedItem.deleted) {

						// cleanup all my interactions with this item
						// the 'about' field has an implied hierarchy
						// endpoint/post/xxx
						// endpoint/post/xxx/comment/xxx
						// endpoint/post/xxx/reaction/xxx
						// endpoint/post/xxx/photo/xxx/comment/xxx
						// etc.
						// so if the post is deleted we should cleanup all the things we did to that post
						// we cand find them all with a regex

						var match = new RegExp('^' + myNewsFeedItem.about + '/');

						if (myNewsFeedItem.type === 'post') {
							match = new RegExp('^' + myNewsFeedItem.about);
						}

						async.series([
							function updateNewsFeedItem(cb) {
								var q = {
									'where': {
										'and': [{
											'userId': currentUser.id
										}, {
											'about': {
												'like': match
											}
										}]
									}
								};
								server.models.NewsFeedItem.find(q, function (err, items) {
									for (var i = 0; i < items.length; i++) {
										items[i].deleted = true;
										items[i].save();
									}
									cb(err);
								});
							},
							function updatePushNewsFeedItem(cb) {
								var q = {
									'where': {
										'and': [{
											'about': {
												'like': match
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
				if (message.type !== 'create' && message.type !== 'update' && message.type !== 'backfill') {
					debug('watchFeed listener ' + currentUser.username + ' received ' + message.type + ' but NewsFeedItem not found %j', myNewsFeedItem);
					return;
				}

				if (myNewsFeedItem.deleted) {
					debug('watchFeed listener ' + currentUser.username + ' received ' + message.type + ' marked as deleted but NewsFeedItem not found %j', myNewsFeedItem);
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

					async.waterfall([
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
							},
							function getUserSettings(cb) {
								utils.getUserSettings(server, currentUser, function (err, settings) {
									cb(err, settings);
								});
							},
							function doEmailNotifications(settings, cb) {
								var wantNotification = false;
								var template = '';
								var options = {
									'to': currentUser.email,
									'from': process.env.OUTBOUND_MAIL_SENDER,
									'config': server.locals.config,
									'item': message.data
								};

								if (message.data.type === 'post' && settings.notifications_posts) {
									wantNotification = true;
									template = 'emails/notify-post-activity';
									options.subject = 'posted';
									options.endpoint = message.data.about;
								}
								else if (message.data.type === 'comment' && settings.notifications_comments) {
									wantNotification = true;
									template = 'emails/notify-post-activity';
									options.subject = 'commented';
									options.endpoint = message.data.about + '/comment/' + message.data.uuid;
								}
								else if (message.data.type === 'react' && settings.notifications_reactions) {
									wantNotification = true;
									template = 'emails/notify-post-activity';
									options.subject = 'reacted';
									options.endpoint = message.data.about;
									var reactions = {
										'thumbs-up': '👍🏼',
										'thumbs-down': '👎',
										'love': '❤️',
										'laugh': '😆',
										'smirk': '😏',
										'wow': '😮',
										'cry': '😢',
										'mad': '😡',
										'vomit': '🤮'
									};
									options.reactionDetails = reactions[message.data.details.reaction];
								}

								//console.log(wantNotification, options);

								if (!wantNotification) {
									return cb();
								}

								var resolveProfile = require('./resolveProfile');

								async.waterfall([
									function (doneResolve) {
										resolveProfile(server, message.data.source, function (err, profile) {
											doneResolve(err, profile);
										});
									},
									function (profile, doneResolve) {
										if (message.data.type !== 'comment') {
											return doneResolve(err, profile, null);
										}
										utils.getEndPointJSON(server, options.endpoint, currentUser, friend, {
											'json': 1
										}, function (err, data) {
											doneResolve(err, profile, data);
										});
									},
									function (profile, details, doneResolve) {
										var endpoint = options.endpoint;
										if (message.data.type === 'comment') {
											endpoint = details.comment.about;
										}
										utils.getEndPointJSON(server, endpoint, currentUser, null, {
											'json': true,
											'postonly': true
										}, function (err, data) {
											if (err) {
												return doneResolve(err);
											}
											doneResolve(null, profile, details, data);
										});
									}
								], function (err, profile, details, post) {
									options.profile = profile ? profile.profile : null;
									options.comment = details ? details.comment : null;
									options.post = post ? post.post : null;
									options.ogMap = post ? post.ogMap : null;
									options.config = server.locals.config;
									options._ = require('lodash');
									options.marked = server.locals.marked;
									options.type = message.data.type;
									options.subject = options.profile.name + ' ' + options.subject + ' ';
									if (message.data.type !== 'post') {
										options.subject += 'on the post ';
									}
									options.subject += '"' + options.post.description + '"';

									mailer(server, template, options, function (err, info) {
										debug('mail status %j %j', err, info);
										cb();
									});
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
