var cron = require('node-cron');
var async = require('async');
var debug = require('debug')('tasks');
var mailer = require('../lib/mail');
var newsFeedItemResolve = require('../../server/lib/newsFeedResolve');
var resolveProfiles = require('../../server/lib/resolveProfiles');
var optimizeNewsFeedItems = require('../../server/lib/optimizeNewsFeedItems');

var tasks = {};

module.exports = function nag(server, done, username) {
	debug('tasks starting');

	if (username) {
		doNotificationEmail(username, function (err) {

		});
	}

	server.models.MyUser.find({}, function (err, users) {
		async.map(users, function (user, cb) {
			debug('starting task for user ' + user.username);
			// daily
			tasks[user.username] = cron.schedule('15 1 * * *', function () {
				debug('task running for %s', user.username);
				doNotificationEmail(user.username, function (err) {});
			});
			//doNotificationEmail(user.username, function (err) {});
			cb();
		}, function (err) {
			debug('tasks started');
			done();
		});
	});

	function doNotificationEmail(username, done) {
		async.waterfall([
			function (cb) {
				server.models.MyUser.findOne({
					'where': {
						'username': username
					},
					'include': {
						'relation': 'friends',
						'scope': {
							'where': {
								'and': [{
									'status': 'pending'
								}, {
									'originator': {
										'neq': true
									}
								}]
							}
						}
					}
				}, function (err, user) {
					if (err) {
						debug('tasks can\'t read user %j', err);
						return cb(err);
					}

					cb(null, user);
				});
			},
			function (user, cb) {
				// get recent notifications somehow...
				var myEndpoint = server.locals.config.publicHost + '/' + user.username;

				var query = {
					'where': {
						'userId': user.id
					},
					'order': 'createdOn DESC',
					'limit': 30
				};

				server.models.NewsFeedItem.find(query, function (e, items) {
					async.mapSeries(items, resolveProfiles, function (err) {
						items = optimizeNewsFeedItems(items, myEndpoint, user);
						async.map(items, function (item, done) {
							newsFeedItemResolve(user, item, function (err, data) {
								done(err, data);
							});
						}, function (err, notifications) {
							cb(null, user, notifications);
						});
					});
				});

			}
		], function (err, user, notifications) {
			if (!user.friends().length && !notifications.length) {
				return done();
			}

			var options = {
				'to': user.email,
				'from': 'notifications@myantisocial.net',
				'subject': 'While you\'ve been away...',
				'user': user,
				'config': server.locals.config,
				'friends': user.friends(),
				'notifications': notifications
			};

			mailer(server, 'emails/nag', options, function (err) {
				if (err) {
					debug('tasks could not send notifications email %j', err);
					return done();
				}
				done();
			});
		});
	}
};
