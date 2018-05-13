//var PassThrough = require('stream').PassThrough;

var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');
var newsFeedItemResolve = require('../../server/lib/newsFeedResolve');
var resolveProfiles = require('../../server/lib/resolveProfiles');
var proxyEndPoint = require('../../server/lib/proxy-endpoint');
var async = require('async');
var url = require('url');
var server = require('../../server/server');
var RemoteRouting = require('loopback-remote-routing');
var optimizeNewsFeedItems = require('../../server/lib/optimizeNewsFeedItems');
var utils = require('../../server/lib/utilities');

module.exports = function (NewsFeedItem) {

	if (!process.env.ADMIN) {
		RemoteRouting(NewsFeedItem, {
			'only': []
		});
	}

	NewsFeedItem.changeHandlerBackfill = function (socket, options) {
		var user = socket.currentUser;
		var myEndpoint = server.locals.config.publicHost + '/' + user.username;

		var query = {
			'where': {
				'userId': user.id
			},
			'order': 'createdOn DESC',
			'limit': 30
		};

		NewsFeedItem.find(query, function (e, items) {
			if (e) {
				debug('backfilling NewsFeedItem %j error', query, e);
			}
			else {
				debug('backfilling NewsFeedItem %j count', query, items ? items.length : 0);

				async.mapSeries(items, resolveProfiles, function (err) {

					items = optimizeNewsFeedItems(items, myEndpoint, user);

					for (var i = items.length - 1; i >= 0; i--) {
						newsFeedItemResolve(user, items[i], function (err, data) {

							var change = {
								'type': 'create',
								'where': {},
								'data': data,
								'backfill': true,
								'isMe': data.source === myEndpoint,
								'endpoint': utils.whatAbout(data.about, user)
							};

							debugVerbose('backfilling NewsFeedItem %j', data);

							socket.emit('data', change);
						});
					}
				});
			}
		});
	};

	NewsFeedItem.buildWebSocketChangeHandler = function (socket, eventType, options) {
		var user = socket.currentUser;
		var streamDescription = 'user.username->client';
		var myEndpoint = server.locals.config.publicHost + '/' + user.username;

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

			resolveProfiles(data, function (err) {
				var items = optimizeNewsFeedItems([data], myEndpoint, user);
				data = items[0];
				newsFeedItemResolve(user, data, function (err, data) {
					var change = {
						'type': mytype,
						'model': 'NewsFeedItem',
						'eventType': eventType,
						'data': data,
						'isMe': data.source === myEndpoint,
						'endpoint': utils.whatAbout(data.about, user)
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
	};
};
