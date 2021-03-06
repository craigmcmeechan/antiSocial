// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var ensureAdmin = require('../middleware/context-ensureAdminUser');

var utils = require('../lib/utilities');

var optimizeNewsFeedItems = require('../lib/optimizeNewsFeedItems');
var resolveProfiles = require('../lib/resolveProfiles');

var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');

module.exports = function (server) {
	var router = server.loopback.Router();

	if (process.env.TESTBENCH !== 'true') {
		return;
	}

	router.get('/mailing', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res) {
		server.models.MyUser.find({}, function (err, users) {
			var emails = [];
			for (var i = 0; i < users.length; i++) {
				emails.push(users[i].email);
			}
			res.send(emails);
		});
	});

	router.get('/test-token', function (req, res) {
		var accessToken = req.query.token ? req.query.token : req.signedCookies.access_token;

		if (!accessToken) {
			return res.send({
				'status': 'missing access token',
				'headers': req.headers,
				'cookies': req.cookies,
				'signedCookies': req.signedCookies
			});
		}

		server.models.AccessToken.resolve(accessToken, function (err, tokenInstance) {
			if (err || !tokenInstance) {
				return res.send('token not found %s %j', accessToken, err);
			}

			server.models.MyUser.findById(tokenInstance.userId, function (err, user) {

				if (req.query.token) {
					res.cookie('access_token', tokenInstance.id, {
						signed: req.signedCookies ? true : false,
						maxAge: 1000 * tokenInstance.ttl
					});
				}

				res.send({
					'cookie': accessToken,
					'token': tokenInstance,
					'user': user.username,
					'headers': req.headers,
					'cookies': req.cookies,
					'signedCookies': req.signedCookies
				});
			});

		});
	});

	router.get('/testbench-callout', getCurrentUser(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		var endpoint = req.query.endpoint;
		async.waterfall([
			function getComment(cb) {
				utils.getEndPointJSON(server, endpoint, currentUser, null, {
					'json': true
				}, function (err, data) {
					if (err) {
						return next(err);
					}
					cb(null, data);
				});
			},
			function getPost(comment, cb) {

				if (!comment.comment) {
					return cb(null, null, comment);
				}
				utils.getEndPointJSON(server, comment.comment.about, currentUser, null, {
					'json': true,
					'postonly': true
				}, function (err, data) {
					if (err) {
						return next(err);
					}
					cb(null, comment, data);
				});
			}
		], function (err, comment, post) {
			var data = {
				'comment': comment ? comment.comment : null,
				'post': post.post,
				'ogMap': post.ogMap,
				'profile': post.post.resolvedProfiles[post.post.source].profile,
				'type': 'post',
				'testbench': true,
				'reactionDetails': ''
			};
			res.render('cards/post-callout.pug', data);
		});
	});

	router.get('/invalidate-cache', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {
		server.locals.myCache.flushAll();
		res.send(server.locals.myCache.getStats());
	});

	// tell notification listeners to go offline
	function disconnectAllNotificationsListeners() {
		if (server.antisocial.openNotificationsListeners) {
			for (var key in server.antisocial.openNotificationsListeners) {
				var socket = server.antisocial.openNotificationsListeners[key];
				socket.emit('data', {
					'type': 'offline'
				});
			}
		}
	}

	function disconnectAllActivityListeners(user) {
		for (var key in server.antisocial.openActivityListeners) {
			var socket = server.antisocial.openActivityListeners[key];
			if (socket.antisocial.user.id.toString() === user.id.toString()) {
				console.log('disconnecting %s %s', socket.id, socket.antisocial.key);
				socket.disconnect(true);
			}
		}
	}

	router.get('/stop-ws', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {
		server.models.MyUser.find({}, function (err, users) {
			for (var i = 0; i < users.length; i++) {
				disconnectAllActivityListeners(users[i]);
			}
			disconnectAllNotificationsListeners();
			res.send('ok');
		});
	});

	router.get('/start-ws', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {

		var query = {
			'where': {
				'and': [{
					'status': 'accepted'
				}, {
					'originator': true
				}]

			},
			'include': ['user']
		};

		server.models.Friend.find(query, function (err, friends) {
			if (err) {
				console.log('Friend.find failed', err);
				return;
			}

			for (var i = 0; i < friends.length; i++) {
				var friend = friends[i];
				server.antisocial.activityFeed.connect(friend.user(), friend);
			}
		});
		res.send('ok');
	});

	router.get('/status', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {
		var ctx = req.myContext;

		res.render('pages/status', {
			'globalSettings': ctx.get('globalSettings'),
			'currentUser': ctx.get('currentUser'),
			'openActivityListeners': server.antisocial.openActivityListeners,
			'openNotificationsListeners': server.antisocial.openNotificationsListeners,
			'openActivityListeners': server.antisocial.openActivityListeners
		});
	});

	// testbench
	router.get('/testbench-editor', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {
		var ctx = req.myContext;

		res.render('pages/testbench-editor', {
			'globalSettings': ctx.get('globalSettings'),
			'currentUser': ctx.get('currentUser')
		});
	});

	router.get('/testbench-friends', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {
		var ctx = req.myContext;

		res.render('pages/testbench-friends', {
			'globalSettings': ctx.get('globalSettings'),
			'currentUser': ctx.get('currentUser'),
			'needVIS': true
		});
	});

	router.get('/testbench-subscription', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {
		var ctx = req.myContext;
		res.render('pages/testbench-subscription', {
			'globalSettings': ctx.get('globalSettings'),
			'currentUser': ctx.get('currentUser')
		});
	});

	router.get('/testbench-email', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		var mailer = require('../lib/mail');

		for (var i = 1; i <= 5; i++) {
			var options = {
				'to': currentUser ? currentUser.email : 'mrhodes@myantisocial.net',
				'from': process.env.OUTBOUND_MAIL_SENDER,
				'subject': 'Testing email transport: ' + i,
				'config': server.locals.config
			};
			mailer(server, 'emails/test', options, function (err) {
				if (err) {
					var e = new WError(err, 'could not send test email');
					console.log(e.toString());
					console.log(e.stack);
				}
			});
		}
		res.send('ok');

	});

	// testbench
	router.get('/requests', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {
		var ctx = req.myContext;
		async.waterfall([
			function (cb) {
				server.models.Request.find({
					'where': {},
					'order': 'createdOn ASC'
				}, function (err, requests) {
					cb(err, requests);
				});
			},
			function (requests, cb) {
				server.models.Invitation.find({
					'where': {},
					'order': 'createdOn ASC'
				}, function (err, invites) {
					cb(err, requests, invites);
				});
			}
		], function (err, requests, invites) {
			var map = {};
			for (var i = 0; i < invites.length; i++) {
				map[invites[i].email] = invites[i].status;
			}
			res.render('pages/requests', {
				'globalSettings': ctx.get('globalSettings'),
				'currentUser': ctx.get('currentUser'),
				'requests': requests,
				'invited': map
			});
		});

	});

	router.get('/testbench-byuser', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		var myEndpoint = server.locals.config.publicHost + '/' + currentUser.username;

		var query = {
			'where': {
				'userId': currentUser.id
			},
			'order': 'createdOn DESC',
			'limit': 60
		};
		server.models.NewsFeedItem.find(query, function (err, items) {
			async.mapSeries(items, resolveProfiles, function (err) {
				items = optimizeNewsFeedItems(items, myEndpoint, currentUser, true);
				res.render('pages/testbench-byuser', {
					'currentUser': currentUser,
					'items': items
				});
			});
		});
	});

	router.get('/testbench-notifications', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		var pushItems, notifyItems;

		async.series([
			function (cb) {
				server.models.PushNewsFeedItem.find({
					'where': {
						'userId': currentUser.id
					}
				}, function (err, items) {
					pushItems = items;
					cb();
				});
			},
			function (cb) {
				var query;
				if (req.query.uuid) {
					query = {
						'where': {
							'uuid': req.query.uuid
						},
						'include': ['user', 'friend'],
						'order': 'createdOn ASC'
					};
				}
				else {
					query = {
						'where': {
							'userId': currentUser.id
						},
						'include': ['user', 'friend'],
						'order': 'createdOn ASC'
					};
				}

				server.models.NewsFeedItem.find(query, function (err, items) {
					notifyItems = items;
					cb();
				});
			}
		], function (err) {
			res.render('pages/testbench-notifications', {
				'pushItems': pushItems,
				'notifyItems': notifyItems,
				'uuid': req.query.uuid,
				'currentUser': currentUser
			});
		});
	});

	server.use(router);
};
