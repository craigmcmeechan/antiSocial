// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/*
	set up server side friend websocket connection
*/

var url = require('url');
var debug = require('debug')('websockets');
var getDataEventHandler = require('./websocketDataEventHandler');


var watchFeed = function watchFeed(server, friend, currentUser) {
	if (!server.openActivityListeners) {
		server.openActivityListeners = {};
	}

	var key = currentUser.username + '<-' + friend.remoteEndPoint;

	if (server.openActivityListeners[key]) {
		debug('watchFeed %s already listening ', key);
	}
	else {

		var remoteEndPoint = url.parse(friend.remoteEndPoint);
		var feed = remoteEndPoint.protocol + '//' + remoteEndPoint.host;

		var endpoint = remoteEndPoint.protocol === 'https:' ? 'wss' : 'ws';
		endpoint += '://' + remoteEndPoint.host;

		debug('watchFeed %s %s connecting %s', key, remoteEndPoint.protocol, endpoint);

		// if connecting to ourself behind a proxy don't use publicHost
		if (process.env.BEHIND_PROXY === "true") {
			var rx = new RegExp('^' + server.locals.config.websockets);
			if (endpoint.match(rx)) {
				endpoint = endpoint.replace(server.locals.config.websockets, 'ws://localhost:' + server.locals.config.port);
				debug('bypass proxy ' + endpoint);
			}
		}

		// open websocket connection
		var socket = require('socket.io-client')(endpoint, {
			'path': '/antisocial-activity'
		});

		socket.data = {
			'key': key,
			'endpoint': feed,
			'currentUser': currentUser,
			'friend': friend
		};

		server.openActivityListeners[key] = socket;

		// perform authentication
		socket.emit('authentication', {
			'friendAccessToken': friend.remoteAccessToken,
			'friendHighWater': friend.highWater
		});

		// once authenticated succeeds
		socket.on('authenticated', function () {
			var model = 'PushNewsFeedItem';
			var eventType = 'after save';
			var handler = server.models[model].buildWebSocketChangeHandler(socket, eventType);
			socket.data = {
				'key': key,
				'friend': friend,
				'currentUser': currentUser,
				'observers': [{
					'model': model,
					'eventType': eventType,
					'handler': handler
				}]
			};

			// listen for data events from friend
			socket.on('data', getDataEventHandler(server, socket));

			// set up PushNewsFeedItem change observer to emit data events back to friend
			server.models[model].observe(eventType, handler);
			server.models[model].changeHandlerBackfill(socket);
		});
		socket.on('connect', getOpenHandler(server, socket));
		socket.on('disconnect', getCloseHandler(server, socket));
		socket.on('error', getErrorHandler(server, socket));
	}
};

function getOpenHandler(server, socket) {
	return function openHandler(e) {
		socket.data.status = 'open';
		debug('watchFeed openHandler %s', socket.data.key);
	};
}

function getCloseHandler(server, socket) {
	return function closeHandler(e) {
		socket.data.status = 'closed';
		debug('watchFeed closeHandler %s because %j', socket.data.key, e);

		if (socket.data.observers) {
			for (var i = 0; i < socket.data.observers.length; i++) {
				var observer = socket.data.observers[i];
				server.models[observer.model].removeObserver(observer.eventType, observer.handler);
			}
		}

		// we initiated the connection so try to reconnect in 30 seconds
		setTimeout(function () {
			watchFeed(server, socket.data.friend, socket.data.currentUser);
		}, 60000);

		delete server.openActivityListeners[socket.data.key];
	};
}

function getErrorHandler(server, socket) {
	return function errorHandler(e) {
		socket.data.status = 'error';
		debug('watchFeed errorHandler %s %j', socket.data.key, e);
	};
}

module.exports.connect = watchFeed;

module.exports.disConnect = function disConnect(server, friend) {
	for (var key in server.openActivityListeners) {
		var socket = server.openActivityListeners[key];
		if (socket.data.friend.id.toString() === friend.id.toString()) {
			debug('watchFeed disConnect %s closed', socket.data.connectionKey);
			socket.disconnect(true);
			delete server.openActivityListeners[key];
		}
	}
};

module.exports.connectAll = function connectAll(server, user) {
	// poll friends feeds
	var query = {
		'where': {
			'and': [{
				'userId': user.id
			}, {
				'status': 'accepted'
			}, {
				'originator': true
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
			watchFeed(server, friend, user);
		}
	});
};
