var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var ensureAdmin = require('../middleware/context-ensureAdminUser');

var watchFeed = require('../lib/watchFeedWebsockets');
var clientWebsockets = require('../lib/websockets');

var async = require('async');

module.exports = function (server) {
	var router = server.loopback.Router();

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

	// testbench
	router.get('/requests', getCurrentUser(), function (req, res, next) {
		var ctx = req.myContext;
		server.models.Request.find({
			'where': {},
			'order': 'createdOn ASC'
		}, function (err, requests) {
			res.render('pages/requests', {
				'globalSettings': ctx.get('globalSettings'),
				'currentUser': ctx.get('currentUser'),
				'requests': requests
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
