var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var watchFeed = require('../lib/watchFeed');
var resolveProfiles = require('../lib/resolveProfiles');
var forge = require('node-forge');

var url = require('url');
var uuid = require('uuid');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var request = require('request');
var _ = require('lodash');

var debug = require('debug')('friends');

/*
	protocol for making a friend request
  ------------------------------------
	requester sets up pending Friend on server (/friend)
		requester call friendee with requestToken to set up pending Friend record on friendee's server (/friend-request)
			friendee call requester to exchange requestToken for accessToken and publicKey (/friend-exchange)
			friendee returns requestToken to requester
		requester call friendee to exchange requestToken for accessToken and publicKey (/friend-exchange)

	protocol for accepting a friend request
	---------------------------------------
	friendee marks requester as accepted and grants access to 'public' and 'friends' (/accept-friend/:id)
		friendee calls requester to update status (/friend-webhook/friend-request-accepted)
			requester marks friendee as accepted and grants access to 'public' and 'friends'
			requestor begins watching friendee's feed
		friendee begins watching requestor's feed
*/


module.exports = function (server) {
	var router = server.loopback.Router();

	/*
		GET /friend

		must be authenticated user

		expects:
			?endpoint=xxx to be the endpoint url of the desired friend

		returns json:
			{ 'status': 'ok' }

			if status is not 'ok', contains reason for failure
	*/

	router.get('/friend', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		var endpoint = url.parse(req.query.endpoint);
		var invite = req.query.invite;
		var instance = null;
		var unique = 0;
		async.waterfall([
			function checkDupe(cb) { // are we already friends?
				var username = endpoint.pathname.substring(1);
				req.app.models.MyUser.include([currentUser], 'friends', function (err, instances) {
					for (var i = 0; i < instances[0].friends().length; i++) {
						var friend = instances[0].friends()[i];
						if (friend.remoteEndPoint === req.query.endpoint) {
							var e = new VError('duplicate friend request');
							return cb(e);
						}

						if (friend.remoteUsername === username) {
							++unique;
						}
					}
					cb(null);
				});
			},
			function keyPair(cb) {
				var rsa = forge.pki.rsa;
				rsa.generateKeyPair({
					bits: 2048,
					workers: 2
				}, function (err, pair) {
					if (err) {
						var e = new VError(err, '/friend keyPair failed');
						return cb(e);
					}
					var keypair = {
						public: forge.pki.publicKeyToPem(pair.publicKey, 72),
						private: forge.pki.privateKeyToPem(pair.privateKey, 72)
					};
					cb(null, keypair);
				});
			},
			function createFriend(pair, cb) { // create pending Friend record
				currentUser.friends.create({
					'originator': true,
					'status': 'pending',
					'remoteEndPoint': req.query.endpoint,
					'remoteHost': endpoint.protocol + '//' + endpoint.host,
					'remoteUsername': endpoint.pathname.substring(1),
					'localRequestToken': uuid(),
					'localAccessToken': uuid(),
					'keys': pair,
					'audiences': ['public'],
					'uniqueRemoteUsername': unique ? endpoint.pathname.substring(1) + '-' + unique : endpoint.pathname.substring(1)
				}, function (err, friend) {
					if (err) {
						var e = new VError(err, '/friend createFriend failed');
						return cb(e);
					}
					instance = friend;
					cb(null, friend);
				});
			},
			function requestFriend(friend, cb) { // call Friends server with request
				// make friend request on on target endpoint
				var myEndPoint = server.locals.config.publicHost + '/' + currentUser.username;
				var payload = {
					'remoteEndPoint': myEndPoint,
					'requestToken': friend.localRequestToken,
					'invite': invite
				};

				debug('requestFriend ' + myEndPoint + '->' + friend.remoteEndPoint + '/friend-request', payload);

				var options = {
					'url': friend.remoteEndPoint + '/friend-request',
					'form': payload,
					'json': true
				};

				request.post(options, function (err, response, body) {
					var e;

					debug('requestFriend ' + myEndPoint + ' got: %j', body);

					if (err) {
						e = new VError(err, '/friend requestFriend failed');
						return cb(e);
					}

					if (response.statusCode !== 200) {
						e = new VError(err, '/friend requestFriend failed http status:' + response.statusCode);
						return cb(e);
					}

					if (_.get(body, 'status') !== 'ok') {
						e = new VError(err, '/friend requestFriend failed status:' + _.get(body, 'status'));
						return cb(e);
					}

					cb(err, friend, body.requestToken, body.accepted);

				});
			},
			function exchangeToken(friend, requestToken, accepted, cb) {

				var myEndPoint = server.locals.config.publicHost + '/' + currentUser.username;
				var payload = {
					'endpoint': myEndPoint,
					'requestToken': requestToken
				};

				debug('exchangeToken ' + myEndPoint + '->' + friend.remoteEndPoint + '/friend-exchange %j', payload);

				request.post({
					'url': friend.remoteEndPoint + '/friend-exchange',
					'form': payload,
					'json': true
				}, function (err, response, body) {
					debug('exchangeToken ' + myEndPoint + '->' + friend.remoteEndPoint + '/friend-exchange got: %j', body);

					var e;
					if (err) {
						e = new VError(err, '/friend exchangeToken failed');
						return cb(e);
					}

					if (response.statusCode !== 200) {
						e = new VError(err, '/friend exchangeToken got http status:' + response.statusCode);
						return cb(e);
					}

					if (_.get(body, 'status') !== 'ok' || !_.has(body, 'accessToken') || !_.has(body, 'publicKey')) {
						e = new VError(err, '/friend exchangeToken got unexpected response %j', body);
						return cb(e);
					}

					var update = {
						'remoteRequestToken': requestToken,
						'remoteAccessToken': body.accessToken,
						'remotePublicKey': body.publicKey,
						'remoteName': body.name
					};

					if (accepted) {
						update.status = 'accepted';
						update.audiences = ['public', 'community', 'friends'];
					}

					friend.updateAttributes(update, function (err, friend) {
						if (err) {
							e = new VError(err, '/friend exchangeToken error updating friend instance %j', update);
							return cb(e);
						}
						cb(null, friend, accepted);
					});
				});
			}
		], function (err, friend, accepted) {
			if (err) {
				if (instance) {
					instance.destroy();
				}
				var e = new WError(err, 'friend request failed');
				req.logger.error(e.toString());
				res.header('x-digitopia-hijax-flash-level', 'error');
				res.header('x-digitopia-hijax-flash-message', 'friend request failed');
				return res.send({
					'status': e.cause().message
				});
			}
			res.header('x-digitopia-hijax-flash-level', 'info');
			res.header('x-digitopia-hijax-flash-message', 'friend request sent');
			res.send({
				'status': 'ok'
			});

			if (accepted) {
				process.nextTick(function () {
					watchFeed(server, friend);
				});
			}
		});
	});

	/*
		 exchange tokens

		 expects:
			req.body.endpoint
			req.body.requestToken

		 returns json:
			{
				'status': 'ok',
				'accessToken': 'xxx'
				'publicKey': 'xxx'
		 	}

			if failed status contains reason for failure

			http error codes:
				500 error querying database,
				404 friend record not found
	*/

	var exchangeRegex = /^\/([a-zA-Z0-9\-\.]+)\/friend-exchange$/;

	router.post(exchangeRegex, function (req, res, next) {
		var matches = req.url.match(exchangeRegex);

		var endpoint = req.body.endpoint;
		var requestToken = req.body.requestToken;
		var accessToken = req.body.requestToken;

		var publicKey = req.body.publicKey;

		var query = {
			'where': {
				'and': [{
					'localRequestToken': requestToken
				}, {
					'remoteEndPoint': endpoint
				}]
			},
			'include': [{
				'user': ['uploads']
			}]
		};

		req.app.models.Friend.findOne(query, function (err, friend) {
			var e;

			if (err) {
				e = new WError(err, '/friend-exchange error on friend lookup ' + endpoint);
				req.logger.error(e.toString());
				return res.sendStatus(500);
			}

			if (!friend) {
				e = new WError(err, '/friend-exchange could not find friend ' + endpoint);
				req.logger.error(e.toString());
				return res.sendStatus(404);
			}

			var payload = {
				'status': 'ok',
				'accessToken': friend.localAccessToken,
				'publicKey': friend.keys.public,
				'name': friend.user().name
			};

			res.send(payload);
		});
	});

	/*
		 create a pending friend request record
		 called on requstee's server

		 expects:
			req.body.requestEndPoint (requestor)
			req.body.remoteEndPoint (requestee)
			req.body.requestToken (requestee's exchange token)

		 returns:
		 	{
		 		'status': 'ok',
		 		'requestToken': 'xxx'
		 	}

			On error returns error in status

	*/

	var requestRegex = /^\/([a-zA-Z0-9\-\.]+)\/friend-request$/;

	router.post(requestRegex, function (req, res, next) {
		var matches = req.url.match(requestRegex);

		var remoteEndPoint = url.parse(req.body.remoteEndPoint);
		var requestToken = req.body.requestToken;
		var invite = req.body.invite;

		async.waterfall([
			function resolveUser(cb) {
				debug('/friend-request resolveUser');
				req.app.models.MyUser.findOne({
					'where': {
						'username': matches[1]
					},
					'include': ['friends', 'uploads']
				}, function (err, user) {
					var e;

					if (err) {
						e = new VError(err, '/friend-request resolveUser failed');
						return cb(e);
					}
					if (!user) {
						e = new VError(err, '/friend-request resolveUser user not found');
						return cb(e);
					}
					cb(null, user);
				});
			},
			function keyPair(user, cb) {
				debug('/friend-request keyPair');

				var rsa = forge.pki.rsa;
				rsa.generateKeyPair({
					bits: 2048,
					workers: 2
				}, function (err, pair) {
					if (err) {
						var e = new VError(err, '/friend-request keyPair failed');
						return cb(e);
					}

					var keypair = {
						public: forge.pki.publicKeyToPem(pair.publicKey, 72),
						private: forge.pki.privateKeyToPem(pair.privateKey, 72)
					};
					cb(null, user, keypair);
				});
			},
			function createPendingFriend(user, pair, cb) {
				debug('/friend-request createPendingFriend');

				// do we already have a friend with the same username?
				var unique = 0;
				var username = remoteEndPoint.pathname.substring(1);
				for (var i = 0; i < user.friends().length; i++) {
					var friend = user.friends()[i];
					if (friend.remoteUsername === username) {
						++unique;
					}
				}

				user.friends.create({
					'status': 'pending',
					'remoteRequestToken': requestToken,
					'remoteEndPoint': req.body.remoteEndPoint,
					'remoteHost': remoteEndPoint.protocol + '//' + remoteEndPoint.host,
					'remoteUsername': remoteEndPoint.pathname.substring(1),
					'localRequestToken': uuid(),
					'localAccessToken': uuid(),
					'keys': pair,
					'audiences': ['public'],
					'uniqueRemoteUsername': unique ? remoteEndPoint.pathname.substring(1) + '-' + unique : remoteEndPoint.pathname.substring(1)
				}, function (err, friend) {
					if (err) {
						var e = new VError(err, '/friend-request createPendingFriend failed');
						return cb(e);
					}
					cb(null, user, friend);
				});
			},
			function exchangeToken(user, friend, cb) {
				var myEndPoint = server.locals.config.publicHost + '/' + user.username;
				var payload = {
					'endpoint': myEndPoint,
					'requestToken': requestToken
				};

				debug('/friend-request exchangeToken ' + myEndPoint + '->' + friend.remoteEndPoint + '/friend-exchange', payload);

				request.post({
					'url': friend.remoteEndPoint + '/friend-exchange',
					'form': payload,
					'json': true
				}, function (err, response, body) {

					debug('/friend-request exchangeToken ' + myEndPoint + '->' + friend.remoteEndPoint + '/friend-exchange got: %j', body);

					var e;
					if (err) {
						e = new VError(err, '/friend-request exchangeToken request error');
						return cb(e);
					}
					if (response.statusCode !== 200) {
						e = new VError(err, '/friend-request exchangeToken got http status:' + response.statusCode);
						return cb(e);
					}

					if (_.get(body, 'status') !== 'ok' || !_.has(body, 'accessToken') || !_.has(body, 'publicKey')) {
						e = new VError(err, '/friend-request exchangeToken got unexpected response %j', body);
						return cb(e);
					}

					cb(null, user, friend, body.accessToken, body.publicKey, body.name);
				});
			},
			function processInvite(user, friend, token, key, name, cb) {
				if (!invite) {
					return cb(null, user, friend, token, key, name, null);
				}

				server.models.Invitation.findOne({
					'where': {
						'token': invite,
						'status': 'processing'
					},
					'include': ['user']
				}, function (err, invitation) {
					cb(null, user, friend, token, key, name, invitation);
				});
			},
			function saveCredentials(user, friend, token, key, name, invitation, cb) {
				debug('/friend-request saveCredentials');

				var update = {
					'remoteAccessToken': token,
					'remotePublicKey': key,
					'remoteName': name
				};

				if (invitation) {
					update.status = 'accepted';
					update.audiences = ['public', 'community', 'friends'];
				}

				friend.updateAttributes(update, function (err, friend) {
					if (err) {
						var e = new VError(err, '/friend-request saveCredentials error saving');
						return cb(e);
					}
					cb(null, user, friend, invitation);
				});
			},
			function newsFeedPendingFriendRequest(user, friend, invitation, cb) {
				debug('/friend-request newsFeedPendingFriendRequest');

				resolveProfiles(friend, function (e) {
					var sourceProfile = friend.resolvedProfiles[friend.remoteEndPoint];

					var myNewsFeedItem = {
						'userId': user.id,
						'friendId': friend.id,
						'uuid': uuid(),
						'type': invitation ? 'frend invite accepted' : 'pending friend request',
						'source': friend.remoteEndPoint,
						'about': friend.remoteEndPoint,
						'originator': false
					};
					req.app.models.NewsFeedItem.create(myNewsFeedItem, function (err, item) {
						if (err) {
							var e = new VError(err, 'error creating newsfeed item');
							return cb(e);
						}
						cb(null, user, friend, invitation);
					});
				});
			}
		], function (err, user, friend, invitation) {
			if (err) {
				var e = new WError(err, '/friend-request failed');
				req.logger.error(e.toString());
				return res.send({
					'status': e.cause().message
				});
			}

			var payload = {
				'status': 'ok',
				'requestToken': friend.localRequestToken,
				'accepted': invitation ? true : false
			};

			res.send(payload);

			if (invitation) {
				process.nextTick(function () {
					watchFeed(server, friend);
				});
			}
		});
	});

	/*
		 tell friend requestor that friendship has been accepted
		 called on requestee's server
		 expects:
				id of friend request instance
		 returns:
				{ 'status': 'ok' }
	*/

	router.get('/accept-friend', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		var endpoint = req.query.endpoint;

		async.waterfall([
			function readFriend(cb) {
				debug('/accept-friend readFriend');

				req.app.models.Friend.findOne({
					'where': {
						'and': [{
							'userId': currentUser.id
						}, {
							'remoteEndPoint': endpoint
						}, {
							'status': 'pending'
						}]
					},
					'include': [{
						'user': ['uploads']
					}]
				}, function (err, friend) {
					if (err) {
						return cb(new VError(err, '/accept-friend readFriend failed'));
					}
					if (!friend) {
						return cb(new VError('/accept-friend readFriend pending friend not found'));
					}
					if (friend.userId.toString() !== currentUser.id.toString()) {
						return cb(new VError('/accept-friend readFriend access denied %s %s', friend.userId.toString(), currentUser.id.toString()));
					}
					cb(err, friend);
				});
			},
			function callWebhook(friend, cb) {
				debug('/accept-friend callWebhook');

				var payload = {
					'accessToken': friend.remoteAccessToken
				};

				var endpoint = url.parse(friend.remoteEndPoint);

				var options = {
					'url': friend.remoteEndPoint + '/friend-webhook/friend-request-accepted',
					'form': payload,
					'json': true
				};

				//debug('calling friend-webook %j', options);
				debug('callWebhook ' + friend.remoteEndPoint + '/friend-webhook/friend-request-accepted %j', payload);

				request.post(options, function (err, response, body) {
					debug('callWebhook ' + friend.remoteEndPoint + '/friend-webhook/friend-request-accepted got %j', body);

					if (err) {
						return cb(new VError(err, '/accept-friend callWebhook failed'));
					}
					if (response.statusCode !== 200) {
						return cb(new VError('/accept-friend callWebhook http error ' + response.statusCode));
					}
					if (_.get(body, 'status') !== 'ok') {
						return cb(new VError('/accept-friend callWebhook unexpected result %j' + body));
					}

					cb(null, friend);
				});
			},
			function pushNews(friend, cb) {
				debug('/accept-friend pushNews');

				var item = {
					'userId': friend.user().id,
					'uuid': uuid(),
					'type': 'friend',
					'source': server.locals.config.publicHost + '/' + friend.user().username,
					'about': friend.remoteEndPoint,
					'visibility': ['friends'],
					'details': {}
				};
				req.app.models.PushNewsFeedItem.create(item, function (err, item) {
					if (err) {
						return cb(new VError(err, '/accept-friend pushNews could not create PushNewsFeedItem %j', item));
					}
					cb(null, friend);
				});
			},
			function writeBackFriend(friend, cb) {
				debug('/accept-friend writeBackFriend');

				friend.updateAttributes({
					'status': 'accepted',
					'audiences': ['public', 'community', 'friends']
				}, function (err) {
					if (err) {
						return cb(new VError(err, '/accept-friend writeBackFriend failed'));
					}
					cb(err, friend);
				});
			}
		], function (err, friend) {
			if (err) {
				var e = new WError(err, '/accept-friend failed');
				req.logger.error(e.toString());
				return res.send({
					'status': e.cause().message
				});
			}

			debug('/accept-friend opening feed', friend);
			watchFeed(server, friend);

			var payload = {
				'status': 'ok'
			};

			return res.send(payload);
		});
	});

	/*
		 tell originator that friendship has been accepted
		 called on requestor's server
			expects:
				req.params.action 'friend-request-accepted'
				req.body.accessToken
			returns:
				{ 'status': 'ok' }
	*/

	var webhookRegex = /^\/([a-zA-Z0-9\-\.]+)\/friend-webhook\/(friend\-request\-accepted|change\-address)$/;

	router.post(webhookRegex, function (req, res, next) {
		var matches = req.url.match(webhookRegex);
		var ctx = req.myContext;
		var action = matches[2];

		//debug('/friend-webhook/%s got payload %j', action, req.body);

		if (action === 'friend-request-accepted') {

			async.waterfall(
				[
					function readFriend(cb) {
						debug('/friend-webhook/%s readFriend', action);

						req.app.models.Friend.findOne({
							'where': {
								'localAccessToken': req.body.accessToken
							},
							'include': [{
								'user': ['uploads']
							}]
						}, function (err, friend) {
							if (err) {
								return cb(new VError(err, '/friend-webhook/friend-request-accepted readFriend failed'));
							}
							if (!friend) {
								return cb(new VError(err, '/friend-webhook/friend-request-accepted readFriend friend not found'));
							}
							cb(null, friend);
						});
					},
					function saveFriend(friend, cb) {
						debug('/friend-webhook/%s saveFriend', action);

						friend.updateAttributes({
							status: 'accepted',
							audiences: ['public', 'community', 'friends']
						}, function (err) {
							cb(err, friend);
						});
					},
					function pushNews(friend, cb) {
						debug('/friend-webhook/%s pushNews', action);

						var item = {
							'userId': friend.user().id,
							'uuid': uuid(),
							'type': 'friend',
							'source': server.locals.config.publicHost + '/' + friend.user().username,
							'about': friend.remoteEndPoint,
							'visibility': ['friends'],
							'details': {}
						};
						req.app.models.PushNewsFeedItem.create(item, function (err, item) {
							if (err) {
								return cb(new VError(err, '/friend-webhook/friend-request-accepted pushNews could not create PushNewsFeedItem %j', item));
							}
							cb(null, friend);
						});
					}
				],
				function (err, friend) {
					if (err) {
						var e = new WError(err, '/friend-webhook/friend-request-accepted failed');
						req.logger.error(e.toString());
						return res.send({
							'status': e.cause().message
						});
					}

					debug('/friend-webhook/friend-request-accepted opening feed', friend);
					watchFeed(server, friend);

					var payload = {
						'status': 'ok'
					};

					//debug('webhook response %j', payload);

					return res.send(payload);
				});
		}

		if (action === 'change-address') {
			async.waterfall(
				[
					function readFriend(cb) {
						debug('/friend-webhook/%s readFriend', action);

						req.app.models.Friend.findOne({
							'where': {
								'localAccessToken': req.body.accessToken
							}
						}, function (err, friend) {
							if (err) {
								return cb(new VError(err, '/friend-webhook/change-address readFriend failed'));
							}
							if (!friend) {
								return cb(new VError(err, '/friend-webhook/change-address readFriend friend not found'));
							}
							cb(null, friend);
						});
					},
					function saveFriend(friend, cb) {
						debug('/friend-webhook/%s saveFriend', action);

						var parsed = url.parse(req.body.newEndPoint);

						friend.updateAttributes({
							'remoteEndPoint': req.body.newEndPoint,
							'remoteHost': parsed.protocol + '://' + parsed.host,
							'remoteUsername': parsed.pathname.substring(1)
						}, function (err) {
							if (err) {
								return cb(new VError(err, '/friend-webhook/change-address saveFriend failed'));
							}
							cb(err, friend);
						});
					}
				],
				function (err, friend) {
					if (err) {
						var e = new WError(err, 'friend-webhook/address-change failed');
						req.logger.error(e.toString());
						return res.send({
							'status': e.cause().message
						});
					}

					debug('webhook/address-change opening feed', friend);
					watchFeed(server, friend);

					var payload = {
						'status': 'ok'
					};

					debug('webhook response %j', payload);

					return res.send(payload);
				}
			);
		}
	});

	server.use(router);
};
