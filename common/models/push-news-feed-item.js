// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

//var PassThrough = require('stream').PassThrough;
var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');
var encryption = require('../../server/lib/encryption');
var RemoteRouting = require('loopback-remote-routing');
var watchFeed = require('../../server/lib/watchFeedWebsockets');
var server = require('../../server/server');

module.exports = function (PushNewsFeedItem) {
	if (!process.env.ADMIN) {
		RemoteRouting(PushNewsFeedItem, {
			'only': []
		});
	}

	PushNewsFeedItem.changeHandlerBackfill = function (socket, options) {
		var friend = socket.friend;
		var user = friend.user();

		var highwater = socket.highwater ? socket.highwater : 0;
		var streamDescription = user.username + '->' + friend.remoteEndPoint;
		var privateKey = friend.keys.private;
		var publicKey = friend.remotePublicKey;

		var query = {
			'where': {
				'and': [{
					'userId': user.id
				}, {
					'updatedOn': {
						'gt': highwater
					}
				}]
			},
			'order': 'id DESC',
			'limit': 100
		};

		PushNewsFeedItem.find(query, function (e, items) {
			if (e) {
				server.locals.logger.error('backfilling PushNewsFeedItem %j error', query, e);
			}
			else {
				debug('PushNewsFeedItem ' + streamDescription + ' backfilling PushNewsFeedItem %j count %d', query, items ? items.length : 0);

				items.reverse();

				for (var i = 0; i < items.length; i++) {
					var data = items[i];

					// copy data
					data = JSON.parse(JSON.stringify(data));

					var hit = false;

					if (data.visibility.indexOf('public') !== -1) {
						hit = true;
					}
					else {
						if (data.visibility && friend && friend.audiences) {
							for (var j = 0; j < data.visibility.length; j++) {
								if (friend.audiences.indexOf(data.visibility[j]) !== -1) {
									hit = true;
									break;
								}
							}
						}
					}

					if (!hit) {
						var encrypted = encryption.encrypt(publicKey, privateKey, JSON.stringify({
							'uuid': data.uuid
						}));
						var change = {
							'type': 'remove',
							'data': encrypted.data,
							'sig': encrypted.sig,
							'pass': encrypted.pass
						};
						socket.emit('data', change);
					}
					else {

						// if it's a comment only send the comment body to the owner of the post
						if (data.type === 'comment') {
							var about = data.about;
							var whoAbout = about.replace(/\/(post|photo)\/.*$/, '');
							if (friend.remoteEndPoint !== whoAbout) {
								debug('stripping comment body from notification ' + friend.remoteEndPoint + '!==' + whoAbout);
								data.details = {};
								data.versions = [];
							}
							else {
								debug('allowing comment body from notification ' + friend.remoteEndPoint + '===' + whoAbout);
							}
						}

						var encrypted = encryption.encrypt(publicKey, privateKey, JSON.stringify(data));

						var change = {
							'type': 'backfill',
							'data': encrypted.data,
							'sig': encrypted.sig,
							'pass': encrypted.pass
						};

						debugVerbose('backfilling PushNewsFeedItem %j', data);
						socket.emit('data', change);
					}
				}

				// let watcher know if user is online
				if (process.env.CLOSE_IDLE_FEEDS) {
					socket.emit('data', {
						'type': user.online ? 'online' : 'offline'
					});
				}
			}
		});
	};

	PushNewsFeedItem.buildWebSocketChangeHandler = function (socket, eventType, options) {
		var friend = socket.friend;
		var user = friend.user();

		var streamDescription = user.username + '->' + friend.remoteEndPoint;
		var privateKey = friend.keys.private;
		var publicKey = friend.remotePublicKey;

		return function (ctx, next) {

			var where = ctx.where;
			var data = ctx.instance || ctx.data;

			// copy data
			data = JSON.parse(JSON.stringify(data));

			// check instance belongs to user
			if (data.userId.toString() !== user.id.toString()) {
				return next();
			}

			var hit = false;

			if (data.visibility.indexOf('public') !== -1) {
				hit = true;
			}
			else {
				if (data.visibility && friend && friend.audiences) {
					for (var i = 0; i < data.visibility.length; i++) {
						if (friend.audiences.indexOf(data.visibility[i]) !== -1) {
							hit = true;
							break;
						}
					}
				}
			}

			if (!hit) {
				var encrypted = encryption.encrypt(publicKey, privateKey, JSON.stringify({
					'uuid': data.uuid
				}));
				var change = {
					'type': 'remove',
					'data': encrypted.data,
					'sig': encrypted.sig,
					'pass': encrypted.pass
				};
				socket.emit('data', change);
				return next();
			}

			// if it's a comment only send the comment body to the owner of the post

			if (data.type === 'comment') {
				var about = data.about;
				var whoAbout = about.replace(/\/(post|photo)\/.*$/, '');
				if (friend.remoteEndPoint !== whoAbout) {
					debug('stripping comment body from notification ' + friend.remoteEndPoint + '!==' + whoAbout);
					data.details = {};
					data.versions = [];
				}
				else {
					debug('allowing comment body from notification ' + friend.remoteEndPoint + '===' + whoAbout);
				}
			}

			// the data includes the id or the where includes the id
			var target;

			if (data && (data.id || data.id === 0)) {
				target = data.id;
			}
			else if (where && (where.id || where.id === 0)) {
				target = where.id;
			}

			var hasTarget = target === 0 || !!target;

			var mytype;

			switch (eventType) {
			case 'after save':
				if (ctx.isNewInstance === undefined) {
					mytype = hasTarget ? 'update' : 'create';
				}
				else {
					mytype = ctx.isNewInstance ? 'create' : 'update';
				}
				break;
			case 'before delete':
				mytype = 'remove';
				break;
			}
			var encrypted = encryption.encrypt(publicKey, privateKey, JSON.stringify(data));

			var change = {
				'type': mytype,
				'model': 'NewsFeedItem',
				'eventType': eventType,
				'data': encrypted.data,
				'sig': encrypted.sig,
				'pass': encrypted.pass
			};

			socket.emit('data', change);

			next();
		};
	};
};
