var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var ensureAdmin = require('../middleware/context-ensureAdminUser');

var watchFeed = require('../lib/watchFeedWebsockets');
var utils = require('../lib/utilities');

var optimizeNewsFeedItems = require('../lib/optimizeNewsFeedItems');
var resolveProfiles = require('../lib/resolveProfiles');

var clientWebsockets = require('../lib/websockets');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');

module.exports = function (server) {
	var router = server.loopback.Router();

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
				'comment': comment.comment,
				'post': post.post,
				'ogMap': post.ogMap,
				'profile': post.post.resolvedProfiles[post.post.source].profile,
				'type': 'react',
				'testbench': true,
				'reactionDetails': 'vomit'
			};
			res.render('cards/post-callout.pug', data);
		});
	});

	router.get('/invalidate-cache', function (req, res, next) {
		server.locals.myCache.flushAll();
		res.send(server.locals.myCache.getStats());
	});

	router.get('/stop-ws', function (req, res, next) {
		server.models.MyUser.find({}, function (err, users) {
			for (var i = 0; i < users.length; i++) {
				watchFeed.disconnectAll(server, users[i]);
			}
			clientWebsockets.disconnectAll(server);
			res.send('ok');
		});
	});

	router.get('/start-ws', function (req, res, next) {
		var query = {
			'where': {
				'status': 'accepted'
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
				watchFeed.connect(server, friend);
			}
		});
		res.send('ok');
	});

	router.get('/status', getCurrentUser(), function (req, res, next) {
		var ctx = req.myContext;

		res.render('pages/status', {
			'globalSettings': ctx.get('globalSettings'),
			'currentUser': ctx.get('currentUser'),
			'servers': server.openFriendListeners,
			'clients': server.openClientListeners,
			'connections': watchFeed.watchFeedConnections
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

	router.get('/testbench-friends', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;

		res.render('pages/testbench-friends', {
			'globalSettings': ctx.get('globalSettings'),
			'currentUser': ctx.get('currentUser'),
			'needVIS': true
		});
	});

	router.get('/testbench-subscription', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		res.render('pages/testbench-subscription', {
			'globalSettings': ctx.get('globalSettings'),
			'currentUser': ctx.get('currentUser')
		});
	});

	router.get('/testbench-email', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		var mailer = require('../lib/mail');

		for (var i = 1; i <= 5; i++) {
			var options = {
				'to': currentUser.email,
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
	router.get('/requests', getCurrentUser(), function (req, res, next) {
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

	router.get('/testbench-byuser', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
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

	router.get('/testbench-notifications', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
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
