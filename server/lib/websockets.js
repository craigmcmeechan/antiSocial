var debug = require('debug')('websockets');
var watchFeed = require('./watchFeed');

module.exports.mount = function websocketsMount(app) {
	if (!app.openWebsocketClients) {
		app.openWebsocketClients = {};
	}
	require('socketio-auth')(app.io, {
		'authenticate': function (socket, data, callback) {
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
		},
		'postAuthenticate': function (socket, data) {
			if (data.userId) {

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
									bindEvents(socket, eventType, handler);
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

					function bindEvents(socket, eventType, handler) {
						app.models[model].observe(eventType, handler, eventType);

						socket.on('disconnect', function (reason) {
							debug('websocketsChangeHandler ' + socket.currentUser.username + ' disconnect event reason ' + reason);

							if (reason === 'transport close') {
								debug('websocketsChangeHandler ' + socket.currentUser.username + ' stopped subscribing to NewsFeedItem "' + eventType + '" because ' + reason);
								app.models[model].removeObserver(eventType, handler);
								delete app.openWebsocketClients[socket.currentUser.username];
								socket.currentUser.updateAttribute('online', false);
								watchFeed.disconnectAll(app, socket.currentUser);
							}
						});
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
