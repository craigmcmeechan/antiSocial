var cron = require('node-cron');
var async = require('async');
var debug = require('debug')('tasks');
var mailer = require('../lib/mail');
var tasks = {};

module.exports = function nag(server, done, username) {
	debug('tasks starting');

	if (username) {
		//doNotificationEmail(username, function (err) {});
	}

	server.models.MyUser.find({}, function (err, users) {
		async.map(users, function (user, cb) {
			debug('starting task for user ' + user.username);
			// daily
			tasks[user.username] = cron.schedule('0 11 * * *', function () {
				debug('task running for %s', user.username);
				doNotificationEmail(user.username, function (err) {});
			});
			cb();
		}, function (err) {
			debug('tasks started');
			done();
		});
	});

	function doNotificationEmail(username, done) {
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
				return done();
			}

			if (user.online || !user.friends().length) {
				return done();
			}

			var options = {
				'to': user.email,
				'from': 'notifications@myantisocial.net',
				'subject': 'While you\'ve been away...',
				'user': user,
				'config': server.locals.config,
				'friends': user.friends()
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