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
					'createdOn': {
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
					data = JSON.parse(JSON.stringify(data));

					// if it's a comment only send the comment to the owner of the post
					if (data.type === 'comment') {
						var about = data.about;
						var whoAbout = about.replace(/\/(post|photo)\/.*$/, '');
						if (friend.remoteEndPoint !== whoAbout) {
							//console.log(friend.remoteEndPoint + '!==' + whoAbout);
							data.details = {};
							data.versions = [];
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

				// let watcher know if user is online
				if (!process.env.KEEP_FEEDS_OPEN) {
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

			// check instance belongs to user
			if (data.userId.toString() !== user.id.toString()) {
				return next();
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

	// modified from https://gist.github.com/njcaruso/ffa81dfbe491fcb8f176
	/*
	PushNewsFeedItem.streamUpdates = function (username, ctx, cb) {
		var accessToken = ctx.req.headers['friend-access-token'];
		var highwater = ctx.req.headers['friend-high-water'] ? ctx.req.headers['friend-high-water'] : 0;

		debug('PushNewsFeedItem connect request from %s token %s highwater %s', username, accessToken, highwater);

		var logger = ctx.req.logger;

		ctx.req.app.models.MyUser.findOne({
			'where': {
				'username': username
			},
			'include': ['uploads']
		}, function (err, user) {

			if (err || !user) {
				return cb(404);
			}

			var streamDescription = user.username;

			var accessToken = ctx.req.headers['friend-access-token'];

			if (!accessToken) {
				return cb(401);
			}

			ctx.req.app.models.Friend.findOne({
				'where': {
					'localAccessToken': accessToken
				}
			}, function (err, friend) {
				if (err || !friend) {
					return cb(404);
				}

				if (!friend) {
					return cb(new Error('friend not found'));
				}

				var privateKey = friend.keys.private;
				var publicKey = friend.remotePublicKey;

				streamDescription += '->' + friend.remoteEndPoint;

				debug('PushNewsFeedItem ' + streamDescription);

				// ok we have the user and the subscriber friend record if applicable

				var changes = new PassThrough({
					objectMode: true
				});

				if (!ctx.req.app.openServers) {
					ctx.req.app.openServers = {};
				}

				ctx.req.app.openServers[streamDescription] = changes;

				var writeable = true;

				var changeHandler = createChangeHandler('save');

				var heartbeat = null;

				changes.doDestroy = function () {
					writeable = false;

					if (heartbeat) {
						clearInterval(heartbeat);
						heartbeat = null;
					}

					delete ctx.req.app.openServers[streamDescription];

					debug('PushNewsFeedItem ' + streamDescription + ' destroy');

					PushNewsFeedItem.removeObserver('after save', changeHandler);

					if (changes) {
						ctx.res.removeAllListeners('error');
						ctx.res.removeAllListeners('end');
						ctx.res.removeAllListeners('close');
						ctx.req.destroy();
						changes = null;
					}

					friend.updateAttribute('online', false);
					watchFeed.disConnect(ctx.req.app, friend);
				};

				ctx.res.on('error', function (e) {
					debug('PushNewsFeedItem ' + streamDescription + ' error on ' + streamDescription, e);
					changes.doDestroy();
				});

				ctx.res.on('end', function (e) {
					debug('PushNewsFeedItem ' + streamDescription + ' end', e);
					changes.doDestroy();
				});

				ctx.res.on('close', function (e) {
					debug('PushNewsFeedItem ' + streamDescription + ' closed');
					changes.doDestroy();
				});

				friend.updateAttribute('online', true);
				ctx.res.setTimeout(24 * 3600 * 1000);
				ctx.res.set('X-Accel-Buffering', 'no');

				heartbeat = setInterval(function () {
					try {
						if (writeable) {
							changes.write({
								'type': 'heartbeat'
							});
						}
					}
					catch (e) {
						debug('PushNewsFeedItem ' + streamDescription + ' error writing');

					}
				}, 5000);

				if (user.online) {
					watchFeed.connect(ctx.req.app, friend);
				}

				process.nextTick(function () {
					cb(null, changes);

					// push all items since highwater

					var query = {
						'where': {
							'and': [{
								'userId': user.id
							}, {
								'createdOn': {
									'gt': highwater
								}
							}]
						},
						'order': 'id DESC',
						'limit': 100
					};

					PushNewsFeedItem.find(query, function (e, items) {
						if (e) {
							logger.error('backfilling PushNewsFeedItem %j error', query, e);
						}
						else {
							debug('PushNewsFeedItem ' + streamDescription + ' backfilling PushNewsFeedItem %j count %d', query, items ? items.length : 0);

							items.reverse();

							for (var i = 0; i < items.length; i++) {
								var data = items[i];
								data = JSON.parse(JSON.stringify(data));

								// if it's a comment only send the comment to the owner of the post
								if (data.type === 'comment') {
									var about = data.about;
									var whoAbout = about.replace(/\/(post|photo)\/.*$/, '');
									if (friend.remoteEndPoint !== whoAbout) {
										//console.log(friend.remoteEndPoint + '!==' + whoAbout);
										data.details = {};
										data.versions = [];
									}
								}

								var encrypted = encryption.encrypt(publicKey, privateKey, JSON.stringify(data));

								var change = {
									'type': 'backfill',
									'target': data.id,
									'where': {},
									'data': encrypted.data,
									'sig': encrypted.sig,
									'pass': encrypted.pass
								};

								debugVerbose('backfilling PushNewsFeedItem %j', data);
								try {
									if (writeable) {
										changes.write(change);
									}
								}
								catch (e) {
									debug('PushNewsFeedItem ' + streamDescription + ' error writing');
								}
							}

							// let watcher know if user is online
							if (!process.env.KEEP_FEEDS_OPEN) {
								try {
									if (writeable) {
										changes.write({
											'type': user.online ? 'online' : 'offline'
										});
									}
								}
								catch (e) {
									debug('PushNewsFeedItem ' + streamDescription + ' error writing');
								}
							}
						}
					});
				});

				PushNewsFeedItem.observe('after save', changeHandler);

				function createChangeHandler(type) {
					return function (ctx, next) {
						// since it might have set to null via destroy

						if (!changes) {
							return next();
						}

						var where = ctx.where;
						var data = ctx.instance || ctx.data;

						data = JSON.parse(JSON.stringify(data));

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

						// if it's a comment only send the comment to the owner of the post
						if (data.type === 'comment') {
							var about = data.about;
							var whoAbout = about.replace(/\/(post|photo)\/.*$/, '');
							if (friend.remoteEndPoint !== whoAbout) {
								//console.log(friend.remoteEndPoint + '!==' + whoAbout);
								data.details = {};
							}
						}

						if (!hit) {
							return next();
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

						var encrypted = encryption.encrypt(publicKey, privateKey, JSON.stringify(data));

						var change = {
							'target': target,
							'where': where,
							'data': encrypted.data,
							'sig': encrypted.sig,
							'pass': encrypted.pass
						};

						switch (type) {
						case 'save':
							if (ctx.isNewInstance === undefined) {
								change.type = hasTarget ? 'update' : 'create';
							}
							else {
								change.type = ctx.isNewInstance ? 'create' : 'update';
							}
							break;
						case 'delete':
							change.type = 'remove';
							break;
						}

						debug('PushNewsFeedItem ' + streamDescription, change);
						try {
							if (writeable) {
								changes.write(change);
							}
						}
						catch (e) {
							debug('PushNewsFeedItem ' + streamDescription + ' error writing');
						}

						next();
					};
				}
			});
		});
	};

	PushNewsFeedItem.remoteMethod(
		'streamUpdates', {
			description: 'stream news feed to subscribers.',
			accessType: 'READ',
			accepts: [{
				arg: 'username',
				type: 'string',
				required: true
			}, {
				arg: 'options',
				type: 'object',
				http: {
					source: 'context'
				}
			}],
			http: {
				verb: 'get',
				path: '/:username/stream-updates'
			},
			returns: {
				arg: 'changes',
				type: 'ReadableStream',
				json: true
			}
		}
	);
	*/
};
