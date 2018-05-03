var debug = require('debug')('websockets');
var watchFeed = require('./watchFeedWebsockets');

module.exports.disconnectAll = function (app) {
	// tell friends to disconnect
	if (app.openFriendListeners) {
		for (var key in app.openFriendListeners) {
			var connection = app.openFriendListeners[key];
			connection.emit('data', {
				'type': 'offline'
			});
		}
	}

	// tell users to disconnect
	if (app.openClientListeners) {
		for (var key in app.openClientListeners) {
			var connection = app.openClientListeners[key];
			connection.emit('data', {
				'type': 'offline'
			});
		}
	}
};

module.exports.mount = function websocketsMount(app) {
	if (!app.openClientListeners) {
		app.openClientListeners = {};
	}
	if (!app.openFriendListeners) {
		app.openFriendListeners = {};
	}
	require('socketio-auth')(app.io, {
		'timeout': 60000,
		'authenticate': function (socket, data, callback) {
			var friendAccessToken = data.friendAccessToken;
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
			else {
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
			if (data.friend) {
				socket.friend = data.friend;
				socket.highwater = data.friendHighWater || 0;
				socket.currentUser = socket.friend.user();
				socket.connectionKey = socket.friend.remoteEndPoint + '<-' + socket.friend.user().username;
				app.openFriendListeners[socket.connectionKey] = socket;
				if (data.subscriptions) {
					for (var model in data.subscriptions) {
						var events = data.subscriptions[model];
						for (var j = 0; j < events.length; j++) {
							var eventType = events[j];
							if (eventType === 'after save' || eventType === 'before delete') {
								var handler = app.models[model].buildWebSocketChangeHandler(socket, eventType, data);
								bindEvents(socket, model, eventType, handler);
								app.models[model].changeHandlerBackfill(socket);
							}
						}
					}
				}
			}
			else if (data.userId) {
				app.models.MyUser.findById(data.userId, {
					'include': ['friends']
				}, function (err, currentUser) {
					if (err) {
						debug('websocketsMount user not found for token, which is odd.');
						return;
					}
					socket.connectionKey = currentUser.username;
					socket.currentUser = currentUser;
					app.openClientListeners[socket.connectionKey] = socket;

					if (data.subscriptions) {
						for (var model in data.subscriptions) {
							var events = data.subscriptions[model];
							for (var j = 0; j < events.length; j++) {
								var eventType = events[j];
								if (eventType === 'after save' || eventType === 'before delete') {
									var handler = app.models[model].buildWebSocketChangeHandler(socket, eventType, data);
									bindEvents(socket, model, eventType, handler);
									app.models[model].changeHandlerBackfill(socket);
								}
							}
						}
					}

					currentUser.updateAttribute('online', true);
					watchFeed.connectAll(app, currentUser);
				});
			}

			function bindEvents(socket, model, eventType, handler) {
				app.models[model].observe(eventType, handler);

				socket.on('disconnect', function (reason) {
					debug('websocketsChangeHandler ' + socket.connectionKey + ' disconnect event reason ' + reason);
					if (reason === 'transport close' || reason === 'client namespace disconnect') {
						debug('websocketsChangeHandler ' + socket.connectionKey + ' stopped subscribing to NewsFeedItem "' + eventType + '" because ' + reason);
						app.models[model].removeObserver(eventType, handler);
						if (socket.friend) {
							delete app.openFriendListeners[socket.connectionKey];
							socket.friend.updateAttribute('online', false);
							if (!process.env.KEEP_FEEDS_OPEN) {
								watchFeed.disConnect(app, socket.friend);
							}
						}
						else {
							delete app.openClientListeners[socket.connectionKey];
							socket.currentUser.updateAttribute('online', false);
							if (!process.env.KEEP_FEEDS_OPEN) {
								watchFeed.disconnectAll(app, socket.currentUser);
							}
						}
					}
				});
			}
		}
	});

	app.io.on('connection', function (socket) {
		debug('websocketsMount a user connected');
		//socket.on('disconnect', function (reason) {
		//	debug('websocketsMount %s disconnect %s', socket.connectionKey, reason);
		//});
	});
};
