var PassThrough = require('stream').PassThrough;
var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');
var VError = require('verror').VError;
var WError = require('verror').WError;
var encryption = require('../../server/lib/encryption');

module.exports = function (PushNewsFeedItem) {

	// modified from https://gist.github.com/njcaruso/ffa81dfbe491fcb8f176
	PushNewsFeedItem.streamUpdates = function (username, ctx, cb) {
		var accessToken = ctx.req.headers['friend-access-token'];
		var highwater = ctx.req.headers['friend-high-water'] ? ctx.req.headers['friend-high-water'] : 0;

		debug('connect request from %s token %s highwater %s', username, accessToken, highwater);

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

			var streamDescription = 'EventSource pushing ' + user.username;

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

				if (friend) {
					streamDescription += ' -> ' + friend.remoteEndPoint + ' audiences:' + friend.audiences;
				}

				debug(streamDescription);

				// ok we have the user and the subscriber friend record if applicable

				var changes = new PassThrough({
					objectMode: true
				});

				var writeable = true;

				var changeHandler = createChangeHandler('save');

				changes.destroy = function () {
					debug('destroy');
					if (changes) {
						changes.removeAllListeners('error');
						changes.removeAllListeners('end');
					}
					PushNewsFeedItem.removeObserver('after save', changeHandler);
					writeable = false;
					changes = null;
				};

				changes.on('error', function (e) {
					logger.error(streamDescription + ' error on ' + streamDescription, e);
				});

				changes.on('end', function (e) {
					debug(streamDescription + ' end', e);
				});

				ctx.res.setTimeout(24 * 3600 * 1000);
				ctx.res.set('X-Accel-Buffering', 'no');
				ctx.res.on('close', function (e) {
					debug('res closed');
					changes.destroy();
				});

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
							debug('backfilling PushNewsFeedItem %j count %d', query, items ? items.length : 0);

							items.reverse();

							for (var i = 0; i < items.length; i++) {
								var data = items[i];

								var encrypted = encryption.encrypt(publicKey, privateKey, JSON.stringify(data));

								var change = {
									'target': 'create',
									'where': {},
									'data': encrypted.data,
									'sig': encrypted.sig,
									'pass': encrypted.pass
								};

								debugVerbose('backfilling PushNewsFeedItem %j', data);

								changes.write(change);
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

						if (writeable) {
							//debug('notifying ' + streamDescription, change);
							changes.write(change);
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
};
