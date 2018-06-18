// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/*
	This module handles websocket connection authentication and sets up 'data' event handlers and emitters once authenticated.

	Used for client connections and server to server friend connections
*/

var debug = require('debug')('websockets');
var watchFeed = require('./watchFeedWebsockets');
var getDataEventHandler = require('./websocketDataEventHandler');

module.exports.mount = function websocketsMount(app) {
	if (!app.openClients) {
		app.openClients = {};
	}
	if (!app.listeningFriendConnections) {
		app.listeningFriendConnections = {};
	}
	require('socketio-auth')(app.io, {
		'timeout': 60000,
		'authenticate': function (socket, data, callback) {
			var friendAccessToken = data.friendAccessToken;
			// this is a server to server friend connection, authenticate with friend access token
			if (friendAccessToken) {
				var query = {
					'where': {
						'localAccessToken': friendAccessToken
					},
					'include': ['user']
				};
				app.models.Friend.findOne(query, function (err, friend) {
					if (err || !friend) {
						return callback(null, false);
					}
					if (friend.status !== 'accepted') {
						return callback(null, false);
					}
					data.friend = friend;
					data.currentUser = friend.user();
					callback(null, true);
				});
			}
			else { // this is a client connection, authenticate with access_token cookie
				var cookie = require('cookie');
				var cookieParser = require('cookie-parser');
				if (!socket.handshake.headers.cookie) {
					return callback(null, false);
				}
				var cookies = cookie.parse(socket.handshake.headers.cookie);
				var signedCookies = cookieParser.signedCookies(cookies, 'DecodrRing');
				if (!signedCookies.access_token) {
					return callback(null, false);
				}

				app.models.AccessToken.find({
					'where': {
						'id': signedCookies.access_token
					}
				}, function (err, tokenDetail) {
					if (err) throw err;
					if (tokenDetail.length) {
						data.userId = tokenDetail[0].userId;
						debug('websocketsMount access token found');
						callback(null, true);
					}
					else {
						debug('websocketsMount access token not found');
						callback(null, false);
					}
				});
			}
		},
		'postAuthenticate': function (socket, data) {
			// this is a server to server friend connection
			if (data.friend) {
				socket.data = {
					'friend': data.friend,
					'currentUser': data.friend.user(),
					'highwater': data.friendHighWater || 0,
					'connectionKey': data.friend.remoteEndPoint + '<-' + data.friend.user().username
				};
				app.listeningFriendConnections[socket.data.connectionKey] = socket;

				// set up PushNewsFeedItem change observer to emit data events back to friend
				if (data.subscriptions) {
					for (var model in data.subscriptions) {
						var events = data.subscriptions[model];
						if (model === 'PushNewsFeedItem') {
							for (var j = 0; j < events.length; j++) {
								var eventType = events[j];
								if (eventType === 'after save' || eventType === 'before delete') {
									var handler = app.models[model].buildWebSocketChangeHandler(socket, eventType);
									app.models[model].observe(eventType, handler);
									app.models[model].changeHandlerBackfill(socket);
								}
							}
						}
					}
				}

				// listen for data events from friend
				socket.on('data', getDataEventHandler(app, socket));
			}
			else if (data.userId) { // this is a client connection
				app.models.MyUser.findById(data.userId, {
					'include': ['friends']
				}, function (err, currentUser) {
					if (err) {
						debug('websocketsMount user not found for token, which is odd.');
						return;
					}
					socket.data = {
						currentUser: currentUser,
						connectionKey: currentUser.username
					};
					app.openClients[socket.data.connectionKey] = socket;

					if (data.subscriptions) {
						for (var model in data.subscriptions) {
							var events = data.subscriptions[model];
							if (model === 'NewsFeedItem') {
								for (var j = 0; j < events.length; j++) {
									var eventType = events[j];
									if (eventType === 'after save' || eventType === 'before delete') {
										var handler = app.models[model].buildWebSocketChangeHandler(socket, eventType);
										app.models[model].observe(eventType, handler);
										app.models[model].changeHandlerBackfill(socket);
									}
								}
							}
						}
					}

					currentUser.updateAttribute('online', true);
					watchFeed.connectAll(app, currentUser);
				});
			}
		}
	});

	app.io.on('connection', function (socket) {
		//debug('websocketsMount a user connected');
		//socket.on('disconnect', function (reason) {
		//	debug('websocketsMount %s disconnect %s', socket.data.connectionKey, reason);
		//});
	});
};

module.exports.disconnectAll = function (app) {
	// tell friends to disconnect
	if (app.listeningFriendConnections) {
		for (var key in app.listeningFriendConnections) {
			var connection = app.listeningFriendConnections[key];
			connection.emit('data', {
				'type': 'offline'
			});
		}
	}

	// tell users to disconnect
	if (app.openClients) {
		for (var key in app.openClients) {
			var connection = app.openClients[key];
			connection.emit('data', {
				'type': 'offline'
			});
		}
	}
};
