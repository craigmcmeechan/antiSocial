// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/*
	Handles websocket connection authentication and sets up event
	handlers and emitters once authenticated.
*/

var debug = require('debug')('websockets');
var getDataEventHandler = require('./websocketDataEventHandler');


module.exports.mount = function mount(app, listener) {
	if (!app.openNotificationsListeners) {
		app.openNotificationsListeners = {};
	}

	if (!app.openActivityListeners) {
		app.openActivityListeners = {};
	}

	app.ioActivity = require('socket.io')(listener, {
		'path': '/antisocial-activity'
	});

	app.ioNotifications = require('socket.io')(listener, {
		'path': '/antisocial-notifications'
	});

	// friend activity feed
	// authenticate using friendAccessToken
	// then set up model observers and backfill any news since last connected

	require('socketio-auth')(app.ioActivity, {
		'timeout': 60000,
		'authenticate': function (socket, data, callback) {
			if (data.friendAccessToken) {
				var query = {
					'where': {
						'localAccessToken': data.friendAccessToken
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

		},
		'postAuthenticate': function (socket, data) {
			if (data.friend) {
				socket.data = {
					'friend': data.friend,
					'currentUser': data.friend.user(),
					'highwater': data.friendHighWater || 0,
					'key': data.friend.user().username + '<-' + data.friend.remoteEndPoint,
					'observers': []
				};
				app.openActivityListeners[socket.data.key] = socket;

				// set up change observers to emit PushNewsFeedItem data events to friend

				var model = 'PushNewsFeedItem';
				var eventType = 'after save';
				var handler = app.models[model].buildWebSocketChangeHandler(socket, eventType);
				app.models[model].observe(eventType, handler);
				app.models[model].changeHandlerBackfill(socket);
				socket.data.observers.push({
					'model': model,
					'eventType': eventType,
					'handler': handler
				});

				debug('server connect %s', socket.data.key);

				// listen for data events from friend
				socket.on('data', getDataEventHandler(app, socket));

				socket.on('disconnect', function (reason) {
					debug('server disconnect %s %s ', socket.data.key, reason);
					for (var i = 0; i < socket.data.observers.length; i++) {
						var observer = socket.data.observers[i];
						debug('removing model observer', observer);
						app.models[observer.model].removeObserver(observer.eventType, observer.handler);
					}

					socket.data.friend.updateAttribute('online', false);

					delete app.openActivityListeners[socket.data.key];
				});

				socket.data.friend.updateAttribute('online', true);
			}
		}
	});

	// user notification feed
	// authenticate with access_token cookie
	require('socketio-auth')(app.ioNotifications, {
		'timeout': 60000,
		'authenticate': function (socket, data, callback) {
			var cookie = require('cookie');
			var cookieParser = require('cookie-parser');
			if (!socket.handshake.headers.cookie) {
				return callback(null, false);
			}
			var cookies = cookie.parse(socket.handshake.headers.cookie);
			var signedCookies = cookieParser.signedCookies(cookies, app.locals.config.secureCookiePassword);
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
					callback(null, true);
				}
				else {
					callback(null, false);
				}
			});
		},
		'postAuthenticate': function (socket, data) {

			app.models.MyUser.findById(data.userId, function (err, currentUser) {
				if (err) {
					debug('mount user not found for token, which is odd.');
					return;
				}
				socket.data = {
					'currentUser': currentUser,
					'key': currentUser.username,
					'observers': []
				};
				app.openNotificationsListeners[socket.data.key] = socket;

				var model = 'NewsFeedItem';
				var eventType = 'after save';
				var handler = app.models[model].buildWebSocketChangeHandler(socket, eventType);
				app.models[model].observe(eventType, handler);
				app.models[model].changeHandlerBackfill(socket);
				socket.data.observers.push({
					'model': model,
					'eventType': eventType,
					'handler': handler
				});

				debug('client connect %s', socket.data.key);

				socket.on('disconnect', function (reason) {
					debug('client disconnect %s %s ', socket.data.key, reason);
					for (var i = 0; i < socket.data.observers.length; i++) {
						var observer = socket.data.observers[i];
						debug('removing model observer', observer);
						app.models[observer.model].removeObserver(observer.eventType, observer.handler);
					}
					delete app.openNotificationsListeners[socket.data.key];
					socket.data.currentUser.updateAttribute('online', false);
				});

				currentUser.updateAttribute('online', true);
			});
		}
	});
};
