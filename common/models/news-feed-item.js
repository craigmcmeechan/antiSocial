var PassThrough = require('stream').PassThrough;

var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');
var newsFeedItemResolve = require('../../server/lib/newsFeedResolve');
var resolveProfiles = require('../../server/lib/resolveProfiles');
var proxyEndPoint = require('../../server/lib/proxy-endpoint');
var async = require('async');
var url = require('url');
var server = require('../../server/server');
var RemoteRouting = require('loopback-remote-routing');


module.exports = function (NewsFeedItem) {

	if (!process.env.ADMIN) {
		RemoteRouting(NewsFeedItem, {
			'only': ['@live']
		});
	}

	// modified from https://gist.github.com/njcaruso/ffa81dfbe491fcb8f176
	NewsFeedItem.live = function (userId, ctx, cb) {
		var reqContext = ctx.req.getCurrentContext();
		var user = reqContext.get('currentUser');

		var myEndpoint = server.locals.config.publicHost + '/' + user.username;

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
				'limit': 60
			};

			NewsFeedItem.find(query, function (e, items) {
				if (e) {
					logger.error('backfilling NewsFeedItem %j error', query, e);
				}
				else {
					debug('backfilling NewsFeedItem %j count', query, items ? items.length : 0);

					async.map(items, resolveProfiles, function (err) {

						items = resolveSummary(items, myEndpoint);

						for (var i = items.length - 1; i >= 0; i--) {
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
					});
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
					resolveProfiles(data, function (err) {
						var items = resolveSummary([data], myEndpoint);
						data = items[0];
						newsFeedItemResolve(user, data, function (err, data) {
							var change = {
								'type': mytype,
								'target': target,
								'where': where,
								'data': data
							};
							changes.write(change);
						});
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

	function fixNameYou(endpoint, myEndpoint, name) {
		if (endpoint === myEndpoint) {
			return 'you';
		}
		return name;
	}

	function resolveSummary(items, myEndpoint) {

		var map = {};
		var grouped = {};

		// group news feed items by 'about' and 'type'
		for (var i = 0; i < items.length; i++) {
			var key = items[i].about + ':' + items[i].type;
			if (!map[key]) {
				map[key] = 0;
				grouped[key] = [];
			}
			++map[key];
			grouped[key].push(items[i]);
		}

		var newsFeedItems = []

		for (var groupAbout in grouped) {
			var group = grouped[groupAbout];

			var about = group[0].about;
			var endpoint = url.parse(group[0].about).pathname;

			var hash = {};
			var mentions = [];
			var theItem = group[0];

			for (var j = 0; j < group.length; j++) {
				var groupItem = group[j];
				if (groupItem.type === 'comment' || groupItem.type === 'react') {
					if (!hash[groupItem.source]) {
						hash[groupItem.source] = true;
						var mention = '<a href="' + proxyEndPoint(groupItem.source) + '">' + fixNameYou(groupItem.source, myEndpoint, groupItem.resolvedProfiles[groupItem.source].profile.name) + '</a>';
						mentions.push(mention);
					}
				}
			}

			if (mentions.length) {
				var summary = mentions.slice(0, 3).join(', ');

				if (mentions.length > 2) {
					var remainder = mentions.length - 2;
					summary += ' and ' + remainder + ' other';
					if (mentions.length > 2) {
						summary += 's';
					}
				}

				theItem.summary = summary;
				if (theItem.type === 'comment') {
					theItem.summary += ' commented';
				}
				if (theItem.type === 'react') {
					theItem.summary += ' reacted';
				}
			}

			newsFeedItems.push(theItem);
		}

		return newsFeedItems;
	}
};
