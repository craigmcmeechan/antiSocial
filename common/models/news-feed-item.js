var PassThrough = require('stream').PassThrough;

var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');
var newsFeedItemResolve = require('../../server/lib/newsFeedResolve');

module.exports = function (NewsFeedItem) {

	// modified from https://gist.github.com/njcaruso/ffa81dfbe491fcb8f176
	NewsFeedItem.live = function (userId, ctx, cb) {
		var reqContext = ctx.req.getCurrentContext();
		var user = reqContext.get('currentUser');

		var logger = ctx.req.logger;

		if (!user) {
			var error = new Error("Not logged in");
			error.status = 401;
			return cb(error);
		}

		var streamDescription = 'EventSource client ' + user.username;

		var changes = new PassThrough({
			objectMode: true
		});

		var writeable = true;

		var changeHandler = createChangeHandler('save');

		changes.destroy = function () {
			debug(streamDescription + ' stopped watching newsfeed');
			if (changes) {
				changes.removeAllListeners('error');
				changes.removeAllListeners('end');
			}
			NewsFeedItem.removeObserver('after save', changeHandler);
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
			debug(streamDescription + ' response closed');
			changes.destroy();
		});

		debug(streamDescription + ' is watching newsfeed');

		process.nextTick(function () {
			cb(null, changes);

			var query = {
				'where': {
					'userId': user.id
				},
				'order': 'createdOn DESC',
				'limit': 30
			};

			NewsFeedItem.find(query, function (e, items) {
				if (e) {
					logger.error('backfilling NewsFeedItem %j error', query, e);
				}
				else {
					debug('backfilling NewsFeedItem %j count', query, items ? items.length : 0);

					items.reverse();

					for (var i = 0; i < items.length; i++) {
						newsFeedItemResolve(user, items[i], function (err, data) {

							var change = {
								'target': 'create',
								'where': {},
								'data': data,
								'backfill': true
							};

							debugVerbose('backfilling NewsFeedItem %j', data);

							changes.write(change);
						})

					}
				}
			});
		});

		NewsFeedItem.observe('after save', changeHandler);

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

				switch (type) {
				case 'save':
					if (ctx.isNewInstance === undefined) {
						mytype = hasTarget ? 'update' : 'create';
					}
					else {
						mytype = ctx.isNewInstance ? 'create' : 'update';
					}
					break;
				case 'delete':
					mytype = 'remove';
					break;
				}

				if (writeable) {
					newsFeedItemResolve(user, data, function (err, data) {
						var change = {
							'type': mytype,
							'target': target,
							'where': where,
							'data': data
						};
						changes.write(change);
					});
				}

				next();
			};
		}
	};

	NewsFeedItem.remoteMethod(
		'live', {
			description: 'stream news feed to subscribers.',
			accessType: 'READ',
			accepts: [{
				arg: 'id',
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
				path: '/:id/live'
			},
			returns: {
				arg: 'changes',
				type: 'ReadableStream',
				json: true
			}
		}
	);
};
