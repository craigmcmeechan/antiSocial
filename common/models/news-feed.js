var PassThrough = require('stream').PassThrough;

var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');

module.exports = function (NewsFeed) {

	// modified from https://gist.github.com/njcaruso/ffa81dfbe491fcb8f176
	NewsFeed.live = function (userId, ctx, cb) {
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
			NewsFeed.removeObserver('after save', changeHandler);
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

			NewsFeed.find(query, function (e, items) {
				if (e) {
					logger.error('backfilling NewsFeed %j error', query, e);
				}
				else {
					debug('backfilling NewsFeed %j count', query, items ? items.length : 0);

					items.reverse();

					for (var i = 0; i < items.length; i++) {
						var data = items[i];
						var change = {
							'target': 'create',
							'where': {},
							'data': data,
							'backfill': true
						};

						debugVerbose('backfilling NewsFeed %j', data);

						changes.write(change);
					}
				}
			});
		});

		NewsFeed.observe('after save', changeHandler);

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

				var change = {
					target: target,
					where: where,
					data: data
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
					changes.write(change);
				}

				next();
			};
		}
	};

	NewsFeed.remoteMethod(
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
