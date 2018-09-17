// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

//var PassThrough = require('stream').PassThrough;
var debug = require('debug')('pushfeeds');
var debugVerbose = require('debug')('pushfeeds:verbose');
var RemoteRouting = require('loopback-remote-routing');
var server = require('../../server/server');

module.exports = function (PushNewsFeedItem) {
	if (!process.env.ADMIN) {
		RemoteRouting(PushNewsFeedItem, {
			'only': []
		});
	}

	PushNewsFeedItem.changeHandlerBackfill = function (emitter, user, friend, highwater) {

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
						emitter('as-post', 'data', {
							'type': 'remove',
							'data': {
								'uuid': data.uuid
							}
						});
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

						debugVerbose('backfilling PushNewsFeedItem %j', data);
						emitter('as-post', 'data', {
							'type': 'backfill',
							data: data
						});
					}
				}

				// let watcher know if user is online
				if (process.env.CLOSE_IDLE_FEEDS) {
					emitter('as-post', 'data', {
						'type': user.online ? 'online' : 'offline'
					});
				}
			}
		});
	};

	PushNewsFeedItem.buildWebSocketChangeHandler = function (emitter, user, friend) {
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
				emitter('as-post', 'data', {
					'type': 'some-type',
					'data': {
						'uuid': data.uuid
					}
				});
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

			if (ctx.isNewInstance === undefined) {
				mytype = hasTarget ? 'update' : 'create';
			}
			else {
				mytype = ctx.isNewInstance ? 'create' : 'update';
			}

			emitter('as-post', 'data', {
				'type': mytype,
				'data': data
			});

			next();
		};
	};
};
