// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var cron = require('node-cron');
var async = require('async');
var debug = require('debug')('tasks');
var newsFeedItemResolve = require('../lib/newsFeedResolve');
var resolveProfiles = require('../lib/resolveProfiles');
var optimizeNewsFeedItems = require('../lib/optimizeNewsFeedItems');
var utils = require('../lib/utilities');

var _ = require('lodash');

var mailer = require('../lib/mail');

var tasks = {};

module.exports = function nag(server, done, username) {
	if (process.env.NODE_ENV !== 'production') {
		return done();
	}

	debug('starting nag daemon');

	if (username) {
		doNotificationEmail(username, function (err) {

		});
	}

	server.models.MyUser.find({}, function (err, users) {
		var xPerMin = 2;
		var count = 0;
		var minute = 1;


		async.mapSeries(users, function (user, cb) {
			if (++count > xPerMin) {
				++minute;
				count = 0;
			}
			var spec = minute + ' 1 * * *';
			console.log(spec);
			debug('starting task for user ' + user.username);
			// daily
			tasks[user.username] = cron.schedule(spec, function () {
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
				utils.getUserSettings(server, user, function (err, settings) {
					cb(err, user, settings);
				});
			},
			function (user, settings, cb) {
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
							cb(null, user, settings, notifications);
						});
					});
				});

			}
		], function (err, user, settings, notifications) {
			if (!settings.notifications_digest) {
				return done;
			}

			if (!user.friends().length && !notifications.length) {
				return done();
			}

			var options = {
				'to': user.email,
				'from': process.env.OUTBOUND_MAIL_SENDER,
				'subject': 'While you\'ve been away...',
				'user': user,
				'config': server.locals.config,
				'friends': user.friends(),
				'notifications': notifications
			};

			mailer(server, 'emails/nag', options, function (err) {
				if (err) {
					debug('tasks could not send notifications email %j', err);
				}
			});

			done();

		});
	}
};
