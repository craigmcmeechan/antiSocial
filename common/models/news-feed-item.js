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
var watchFeed = require('../../server/lib/watchFeed');

module.exports = function (NewsFeedItem) {

	if (!process.env.ADMIN) {
		RemoteRouting(NewsFeedItem, {
			'only': ['@live']
		});
	}

	NewsFeedItem.buildWebSocketChangeHandler = function (socket, options, events) {
		var user = socket.currentUser;
		var streamDescription = 'user.username->client';
		var myEndpoint = server.locals.config.publicHost + '/' + user.username;

		for (var i = 0; i < events.length; i++) {
			var event = events[i];
			if (event === 'after save' || event === 'before delete') {
				var handler = createWebSocketChangeHandler(event);
			}
		}

		function createWebSocketChangeHandler(observing) {

			var handler = function (ctx, next) {

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

				switch (observing) {
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

				resolveProfiles(data, function (err) {
					var items = resolveSummary([data], myEndpoint, user);
					data = items[0];
					newsFeedItemResolve(user, data, function (err, data) {
						var change = {
							'type': mytype,
							'model': 'NewsFeedItem',
							'observing': observing,
							'data': data
						};
						try {
							socket.emit('data', change);
						}
						catch (e) {
							debug('NewsFeedItem ' + streamDescription + ' error writing');
						}
					});
				});

				next();
			};

			NewsFeedItem.observe(observing, handler);

			socket.on('disconnect', function () {
				console.log(socket.currentUser.username + ' stopped subscribing to NewsFeedItem ' + observing);
				NewsFeedItem.removeObserver(observing, handler);
			});

			return handler;
		}
	};

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

		var streamDescription = user.username;



		var changes = new PassThrough({
			objectMode: true
		});

		if (!ctx.req.app.openClients) {
			ctx.req.app.openClients = {};
		}

		ctx.req.app.openClients[user.username] = changes;

		var writeable = true;

		var changeHandler = createChangeHandler('save');

		var heartbeat;

		changes.destroy = function () {
			writeable = false;

			if (heartbeat) {
				clearInterval(heartbeat);
				heartbeat = null;
			}

			delete ctx.req.app.openClients[user.username];

			debug('NewsFeedItem ' + streamDescription + ' stopped watching newsfeeditems');
			NewsFeedItem.removeObserver('after save', changeHandler);

			if (changes) {
				ctx.res.removeAllListeners('error');
				ctx.res.removeAllListeners('end');
				ctx.res.removeAllListeners('close');
				ctx.req.destroy();
				changes = null;
			}

			user.updateAttribute('online', false);
			watchFeed.disconnectAll(user);
		};

		ctx.res.on('error', function (e) {
			logger.error(streamDescription + ' error on ' + streamDescription, e);
			changes.destroy();
		});

		ctx.res.on('end', function (e) {
			debug('NewsFeedItem ' + streamDescription + ' end', e);
			changes.destroy();
		});

		ctx.res.on('close', function (e) {
			debug('NewsFeedItem ' + streamDescription + ' closed');
			changes.destroy();
		});

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
				debug('NewsFeedItem ' + streamDescription + ' error writing');
			}
		}, 5000);

		user.updateAttribute('online', true);

		debug('NewsFeedItem ' + streamDescription + ' is watching newsfeed');

		watchFeed.connectAll(user);



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

						items = resolveSummary(items, myEndpoint, user);

						for (var i = items.length - 1; i >= 0; i--) {
							newsFeedItemResolve(user, items[i], function (err, data) {

								var change = {
									'type': 'create',
									'where': {},
									'data': data,
									'backfill': true
								};

								debugVerbose('backfilling NewsFeedItem %j', data);

								try {
									if (writeable) {
										changes.write(change);
									}
								}
								catch (e) {
									debug('NewsFeedItem ' + streamDescription + ' error writing');
								}
							});
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
						var items = resolveSummary([data], myEndpoint, user);
						data = items[0];
						newsFeedItemResolve(user, data, function (err, data) {
							var change = {
								'type': mytype,
								'target': target,
								'where': where,
								'data': data
							};
							try {
								if (writeable) {
									changes.write(change);
								}
							}
							catch (e) {
								debug('NewsFeedItem ' + streamDescription + ' error writing');
							}
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

	function resolveSummary(items, myEndpoint, user) {

		var map = {};
		var grouped = {};

		// group news feed items by 'about' and 'type'
		for (var i = 0; i < items.length; i++) {
			var about = items[i].about;
			about = about.replace(/\/comment.*$/, '');
			var key = about + ':' + items[i].type;
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
						var mention = '<a href="' + proxyEndPoint(groupItem.source, user) + '">' + fixNameYou(groupItem.source, myEndpoint, groupItem.resolvedProfiles[groupItem.source].profile.name) + '</a>';
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
