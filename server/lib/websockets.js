var debug = require('debug')('websockets');
var watchFeed = require('./watchFeedWebsockets');

module.exports.mount = function websocketsMount(app) {
	if (!app.openWebsocketClients) {
		app.openWebsocketClients = {};
	}
	if (!app.openWebsocketServers) {
		app.openWebsocketServers = {};
	}
	require('socketio-auth')(app.io, {
		'authenticate': function (socket, data, callback) {
			var friendAccessToken = socket.handshake.query['friend-access-token'];
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
				socket.highwater = socket.handshake.query['friend-high-water'] || 0;
				app.openWebsocketServers[data.friend.remoteEndpoint + '<-' + data.friend.user().username] = socket;
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

					socket.currentUser = currentUser;
					app.openWebsocketClients[currentUser.username] = socket;

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

					socket.on('data', function (data) {
						debug('websocketsMount got: %j from %s', data, socket.currentUser.username);
					});
				});
			}

			function bindEvents(socket, model, eventType, handler) {
				app.models[model].observe(eventType, handler);

				socket.on('disconnect', function (reason) {
					var description = data.friend ? socket.friend.remoteEndpoint + '<-' + socket.friend.user().username : socket.currentUser.username;
					debug('websocketsChangeHandler ' + description + ' disconnect event reason ' + reason);
					if (reason === 'transport close') {
						debug('websocketsChangeHandler ' + description + ' stopped subscribing to NewsFeedItem "' + eventType + '" because ' + reason);
						app.models[model].removeObserver(eventType, handler);
						delete app.openWebsocketClients[socket.currentUser.username];
						socket.currentUser.updateAttribute('online', false);
						watchFeed.disconnectAll(app, socket.currentUser);
					}
				});
			}
		}
	});

	app.io.on('connection', function (socket) {
		debug('websocketsMount a user connected');
		socket.on('disconnect', function (reason) {
			debug('websocketsMount user %s disconnected %s', socket.currentUser ? socket.currentUser.username : 'unknown', reason);
		});
	});
};
