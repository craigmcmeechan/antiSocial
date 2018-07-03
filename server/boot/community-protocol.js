// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var forge = require('node-forge');
var crc = require('crc');

var url = require('url');
var uuid = require('uuid');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var request = require('request');
var _ = require('lodash');

var debug = require('debug')('communities');

module.exports = function (server) {
	var router = server.loopback.Router();

	/*
		GET /join

		Originator of subscription request. Must be authenticated user.

		expects:
			?endpoint=xxx to be the endpoint url of the community to join

		returns json:
			{ 'status': 'ok' }

			if status is not 'ok', contains reason for failure
	*/

	router.get('/join', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		var instance = null;
		async.waterfall([
			function checkDupe(cb) { // are we already a member?
				req.app.models.MyUser.include([currentUser], 'subscriptions', function (err, instances) {
					for (var i = 0; i < instances[0].subscriptions().length; i++) {
						var subscription = instances[0].subscriptions()[i];
						if (subscription.remoteEndPoint === req.query.endpoint) {
							var e = new VError('duplicate subscription request');
							return cb(e);
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
						var e = new VError(err, '/join keyPair failed');
						return cb(e);
					}
					var keypair = {
						public: forge.pki.publicKeyToPem(pair.publicKey, 72),
						private: forge.pki.privateKeyToPem(pair.privateKey, 72)
					};
					cb(null, keypair);
				});
			},
			function createSubscription(pair, cb) { // create pending subscription record
				var unique = '';
				var parsed = url.parse(req.query.endpoint);
				var communityName = parsed.pathname.substring(1);

				for (var i = 0; i < currentUser.subscriptions.length; i++) {
					if (currentUser.subscriptions.communityName === communityName) {
						++unique;
					}
				}

				currentUser.subscriptions.create({
					'status': 'pending',
					'remoteEndPoint': req.query.endpoint,
					'localRequestToken': uuid(),
					'localAccessToken': uuid(),
					'keys': pair,
					'communityName': unique ? parsed.pathname.substring(1) + '-' + unique : parsed.pathname.substring(1)
				}, function (err, subscription) {
					if (err) {
						var e = new VError(err, '/join createSubscription failed');
						return cb(e);
					}
					instance = subscription;
					cb(null, subscription);
				});
			},
			function requestSubscription(subscription, cb) { // call community server with request
				var myEndPoint = server.locals.config.publicHost + '/' + currentUser.username;
				var payload = {
					'remoteEndPoint': myEndPoint,
					'requestToken': subscription.localRequestToken
				};

				debug('requestSubscription ' + myEndPoint + '->' + subscription.remoteEndPoint + '/join-request', payload);

				var options = {
					'url': fixIfBehindProxy(subscription.remoteEndPoint + '/join-request'),
					'form': payload,
					'json': true
				};

				request.post(options, function (err, response, body) {
					var e;

					debug('requestSubscription ' + myEndPoint + ' got: %j', body);

					if (err) {
						e = new VError(err, '/join requestSubscription failed');
						return cb(e);
					}

					if (response.statusCode !== 200) {
						e = new VError(err, '/join requestSubscription failed http status:' + response.statusCode);
						return cb(e);
					}

					if (_.get(body, 'status') !== 'ok') {
						e = new VError(err, '/join requestSubscription failed status:' + _.get(body, 'status'));
						return cb(e);
					}

					cb(err, subscription, body.requestToken, body.accepted);

				});
			},
			function exchangeToken(subscription, requestToken, accepted, cb) {

				var myEndPoint = server.locals.config.publicHost + '/' + currentUser.username;
				var payload = {
					'endpoint': myEndPoint,
					'requestToken': requestToken,
					'type': subscription
				};

				debug('exchangeToken ' + myEndPoint + '->' + subscription.remoteEndPoint + '/join-exchange %j', payload);

				request.post({
					'url': fixIfBehindProxy(subscription.remoteEndPoint + '/join-exchange'),
					'form': payload,
					'json': true
				}, function (err, response, body) {
					debug('exchangeToken ' + myEndPoint + '->' + subscription.remoteEndPoint + '/join-exchange got: %j', body);

					var e;
					if (err) {
						e = new VError(err, '/join exchangeToken failed');
						return cb(e);
					}

					if (response.statusCode !== 200) {
						e = new VError(err, '/join exchangeToken got http status:' + response.statusCode);
						return cb(e);
					}

					if (_.get(body, 'status') !== 'ok' || !_.has(body, 'accessToken') || !_.has(body, 'publicKey')) {
						e = new VError(err, '/join exchangeToken got unexpected response %j', body);
						return cb(e);
					}

					var update = {
						'remoteRequestToken': requestToken,
						'remoteAccessToken': body.accessToken,
						'remotePublicKey': body.publicKey
					};

					if (accepted) {
						update.status = 'accepted';
					}

					subscription.updateAttributes(update, function (err, subscription) {
						if (err) {
							e = new VError(err, '/join exchangeToken error updating subscription instance %j', update);
							return cb(e);
						}
						cb(null, subscription, accepted);
					});
				});
			}
		], function (err, subscription, accepted) {
			if (err) {
				if (instance) {
					instance.destroy();
				}
				var e = new WError(err, 'subscription request failed');
				req.logger.error(e.toString());
				res.header('x-digitopia-hijax-flash-level', 'error');
				res.header('x-digitopia-hijax-flash-message', 'subscription request failed');
				return res.send({
					'status': e.cause().message
				});
			}
			res.header('x-digitopia-hijax-flash-level', 'info');
			res.header('x-digitopia-hijax-flash-message', 'subscription request sent');
			res.send({
				'status': 'ok'
			});
		});
	});

	/*
		 exchange tokens

		 expects:
			req.body.endpoint
			req.body.requestToken
			req.body.type "member" or "subscription"

		 returns json:
			{
				'status': 'ok',
				'accessToken': 'xxx'
				'publicKey': 'xxx'
		 	}

			if failed status contains reason for failure

			http error codes:
				500 error querying database,
				404 subscription/member record not found
	*/

	var exchangeRegex = /^\/.*([a-zA-Z0-9\-.]+)\/join-exchange$/;

	router.post(exchangeRegex, function (req, res) {
		var matches = req.url.match(exchangeRegex);
		var endpoint = req.body.endpoint;
		var requestToken = req.body.requestToken;
		var type = req.body.type;

		if (type === 'member') {
			async.waterfall([
				function findUser(cb) {
					req.app.models.MyUser.findOne({
						'where': {
							'username': matches[1]
						}
					}, function (err, user) {
						if (err) {
							return cb(new VError(err, 'error finding user'));
						}
						cb(null, user);
					});
				},
				function findSubscription(user, cb) {
					var query = {
						'where': {
							'and': [{
								'localRequestToken': requestToken
							}, {
								'remoteEndPoint': endpoint
							}, {
								'userId': user.id
							}]
						}
					};

					req.app.models.Subscription.findOne(query, function (err, subscription) {
						cb(err, subscription);
					});
				}
			], function (err, subscription) {
				var e;

				if (err) {
					e = new WError(err, '/join-exchange failed ' + endpoint);
					req.logger.error(e.toString());
					return res.sendStatus(500);
				}

				if (!subscription) {
					e = new WError(err, '/join-exchange could not find subscription ' + endpoint);
					req.logger.error(e.toString());
					return res.sendStatus(404);
				}

				var payload = {
					'status': 'ok',
					'accessToken': subscription.localAccessToken,
					'publicKey': subscription.keys.public
				};

				res.send(payload);
			});
		}
		else {
			async.waterfall([
				function findCommunity(cb) {
					req.app.models.Community.findOne({
						'where': {
							'nickname': matches[1]
						}
					}, function (err, community) {
						if (err) {
							return cb(new VError(err, 'error finding community'));
						}
						cb(null, community);
					});
				},
				function findMember(community, cb) {
					if (!community) {
						return cb();
					}
					var query = {
						'where': {
							'and': [{
								'localRequestToken': requestToken
							}, {
								'remoteEndPoint': endpoint
							}, {
								'communityId': community.id
							}]
						}
					};

					req.app.models.Member.findOne(query, function (err, member) {
						cb(err, community, member);
					});
				}
			], function (err, community, member) {
				var e;

				if (err) {
					e = new WError(err, '/join-exchange failed ' + endpoint);
					req.logger.error(e.toString());
					return res.sendStatus(500);
				}

				if (!community) {
					e = new WError(err, '/join-exchange could not find community ' + endpoint);
					req.logger.error(e.toString());
					return res.sendStatus(404);
				}

				if (!member) {
					e = new WError(err, '/join-exchange could not find member ' + endpoint);
					req.logger.error(e.toString());
					return res.sendStatus(404);
				}

				var payload = {
					'status': 'ok',
					'accessToken': member.localAccessToken,
					'publicKey': member.keys.public
				};

				res.send(payload);
			});
		}
	});

	/*
		 create a pending member record
		 called on community server

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

	var requestRegex = /^\/community\/([a-zA-Z0-9\-.]+)\/join-request$/;

	router.post(requestRegex, function (req, res, next) {
		var matches = req.url.match(requestRegex);

		var remoteEndPoint = url.parse(req.body.remoteEndPoint);
		var requestToken = req.body.requestToken;

		async.waterfall([
			function findCommunity(cb) {
				debug('/join-request findCommunity');
				req.app.models.Community.findOne({
					'where': {
						'nickname': matches[1]
					},
					'include': ['members']
				}, function (err, community) {
					var e;

					if (err) {
						e = new VError(err, '/join-request findCommunity failed');
						return cb(e);
					}
					if (!community) {
						e = new VError(err, '/join-request community not found');
						return cb(e);
					}
					cb(null, community);
				});
			},
			function keyPair(community, cb) {
				debug('/join-request keyPair');

				var rsa = forge.pki.rsa;
				rsa.generateKeyPair({
					bits: 2048,
					workers: 2
				}, function (err, pair) {
					if (err) {
						var e = new VError(err, '/join-request keyPair failed');
						return cb(e);
					}

					var keypair = {
						public: forge.pki.publicKeyToPem(pair.publicKey, 72),
						private: forge.pki.privateKeyToPem(pair.privateKey, 72)
					};
					cb(null, community, keypair);
				});
			},
			function createPendingMember(community, pair, cb) {
				debug('/join-request createPendingMember');

				// do we already have a member with the same username?
				var unique = 0;
				var username = remoteEndPoint.pathname.substring(1);
				for (var i = 0; i < community.members().length; i++) {
					var member = community.members()[i];
					if (member.remoteUsername === username) {
						++unique;
					}
				}

				community.members.create({
					'status': 'pending',
					'remoteRequestToken': requestToken,
					'remoteEndPoint': req.body.remoteEndPoint,
					'remoteHost': remoteEndPoint.protocol + '//' + remoteEndPoint.host,
					'remoteUsername': remoteEndPoint.pathname.substring(1),
					'localRequestToken': uuid(),
					'localAccessToken': uuid(),
					'keys': pair,
					'audiences': ['public'],
					'uniqueRemoteUsername': unique ? remoteEndPoint.pathname.substring(1) + '-' + unique : remoteEndPoint.pathname.substring(1),
					'hash': crc.crc32(req.body.remoteEndPoint).toString(16)
				}, function (err, member) {
					if (err) {
						var e = new VError(err, '/join-request createPendingMember failed');
						return cb(e);
					}
					cb(null, community, member);
				});
			},
			function exchangeToken(community, member, cb) {
				var myEndPoint = server.locals.config.publicHost + '/' + community.nickname;
				var payload = {
					'endpoint': myEndPoint,
					'requestToken': requestToken,
					'type': 'member'
				};

				debug('/join-request exchangeToken ' + myEndPoint + '->' + member.remoteEndPoint + '/join-exchange', payload);

				request.post({
					'url': fixIfBehindProxy(member.remoteEndPoint + '/join-exchange'),
					'form': payload,
					'json': true
				}, function (err, response, body) {

					debug('/join-request exchangeToken ' + myEndPoint + '->' + member.remoteEndPoint + '/join-exchange got: %j', body);

					var e;
					if (err) {
						e = new VError(err, '/join-request exchangeToken request error');
						return cb(e);
					}
					if (response.statusCode !== 200) {
						e = new VError(err, '/join-request exchangeToken got http status:' + response.statusCode);
						return cb(e);
					}

					if (_.get(body, 'status') !== 'ok' || !_.has(body, 'accessToken') || !_.has(body, 'publicKey')) {
						e = new VError(err, '/join-request exchangeToken got unexpected response %j', body);
						return cb(e);
					}

					cb(null, community, member, body.accessToken, body.publicKey, body.name);
				});
			},
			function saveCredentials(community, member, token, key, name, cb) {
				debug('/join-request saveCredentials');

				var update = {
					'remoteAccessToken': token,
					'remotePublicKey': key,
					'remoteName': name
				};

				member.updateAttributes(update, function (err, member) {
					if (err) {
						var e = new VError(err, '/join-request saveCredentials error saving');
						return cb(e);
					}
					cb(null, community, member);
				});
			}
		], function (err, community, member) {
			if (err) {
				var e = new WError(err, '/join-request failed');
				req.logger.error(e.toString());
				return res.send({
					'status': e.cause().message
				});
			}

			var payload = {
				'status': 'ok',
				'requestToken': member.localRequestToken
			};

			res.send(payload);
		});
	});

	/*
		 tell subscription requestor that membership has been accepted
		 called on requestee's server
		 expects:
				id of member request instance
		 returns:
				{ 'status': 'ok' }
	*/

	var acceptRegex = /^\/community\/([a-zA-Z0-9\-.]+)\/accept-member/;

	router.get(acceptRegex, getCurrentUser(), ensureLoggedIn(), function (req, res) {
		var matches = req.url.match(acceptRegex);

		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		var endpoint = req.query.endpoint;

		async.waterfall([
			function findCommunity(cb) {
				debug('/accept-member findCommunity');
				req.app.models.Community.findOne({
					'where': {
						'nickname': matches[1]
					}
				}, function (err, community) {
					var e;

					if (err) {
						e = new VError(err, '/accept-member findCommunity failed');
						return cb(e);
					}
					if (!community) {
						e = new VError(err, '/accept-member findCommunity community not found');
						return cb(e);
					}
					cb(null, community);
				});
			},
			function readMember(community, cb) {
				debug('/accept-member readMember');

				var query = {
					'where': {
						'and': [{
							'communityId': community.id
						}, {
							'remoteEndPoint': endpoint
						}, {
							'status': 'pending'
						}]
					}
				};

				req.app.models.Member.findOne(query, function (err, member) {
					if (err) {
						return cb(new VError(err, '/accept-member readMember failed'));
					}
					if (!member) {
						return cb(new VError('/accept-member readMember pending member not found %j', query));
					}
					cb(err, member);
				});
			},
			function callWebhook(member, cb) {
				debug('/accept-member callWebhook');

				var payload = {
					'accessToken': member.remoteAccessToken
				};


				var options = {
					'url': fixIfBehindProxy(member.remoteEndPoint + '/subscribe-webhook/subscription-request-accepted'),
					'form': payload,
					'json': true
				};

				//debug('calling join-webook %j', options);
				debug('callWebhook ' + member.remoteEndPoint + '/subscribe-webhook/subscription-request-accepted %j', payload);

				request.post(options, function (err, response, body) {
					debug('callWebhook ' + member.remoteEndPoint + '/subscribe-webhook/subscription-request-accepted got %j', body);

					if (err) {
						return cb(new VError(err, '/accept-member callWebhook failed'));
					}
					if (response.statusCode !== 200) {
						return cb(new VError('/accept-member callWebhook http error ' + response.statusCode));
					}
					if (_.get(body, 'status') !== 'ok') {
						return cb(new VError('/accept-member callWebhook unexpected result %j' + body));
					}

					cb(null, member);
				});
			},
			function writeBackMember(member, cb) {
				debug('/accept-member writeBackMember');

				member.updateAttributes({
					'status': 'accepted',
				}, function (err) {
					if (err) {
						return cb(new VError(err, '/accept-member writeBackMember failed'));
					}
					cb(err, member);
				});
			}
		], function (err, member) {
			if (err) {
				var e = new WError(err, '/accept-member failed');
				req.logger.error(e.toString());
				return res.send({
					'status': e.cause().message
				});
			}

			var payload = {
				'status': 'ok'
			};

			return res.send(payload);
		});
	});

	/*
		 tell originator that subscription has been accepted
		 called on requestor's server
			expects:
				req.params.action 'subscription-request-accepted'
				req.body.accessToken
			returns:
				{ 'status': 'ok' }
	*/


	var webhookRegex = /^\/([a-zA-Z0-9\-.]+)\/subscribe-webhook\/(subscription-request-accepted|subscription-request-canceled|subscription-request-declined)$/;

	router.post(webhookRegex, function (req, res) {
		var matches = req.url.match(webhookRegex);
		var ctx = req.myContext;
		var action = matches[2];

		req.app.models.Subscription.findOne({
			'where': {
				'localAccessToken': req.body.accessToken
			},
			'include': [{
				'user': ['uploads']
			}]
		}, function (err, subscription) {
			if (err) {
				var error = new WError(err, '/' + action + ' readSubscription failed');
				req.logger.error(error.toString());
				return res.send({
					'status': error.cause().message
				});
			}
			if (!subscription) {
				var error = WError(err, '/' + action + ' readSubscription subscription not found');
				req.logger.error(error.toString());
				return res.send({
					'status': error.cause().message
				});
			}

			if (action === 'subscription-request-canceled' || action === 'subscription-request-declined') {
				subscription.destroy();
				var payload = {
					'status': 'ok'
				};
				return res.send(payload);
			}

			if (action === 'subscription-request-accepted') {
				async.waterfall([
						function saveSubscription(cb) {
							debug('/subscribe-webhook/%s saveSubscription', action);

							subscription.updateAttributes({
								status: 'accepted',
							}, function (err) {
								cb(err, subscription);
							});
						}
					],
					function (err, subscription) {
						if (err) {
							var e = new WError(err, '/subscribe-webhook/subscription-request-accepted failed');
							req.logger.error(e.toString());
							return res.send({
								'status': e.cause().message
							});
						}

						var payload = {
							'status': 'ok'
						};

						//debug('webhook response %j', payload);

						return res.send(payload);
					});
			}
		});
	});

	server.use(router);

	function fixIfBehindProxy(url) {
		if (process.env.BEHIND_PROXY === "true") {
			var rx = new RegExp('^' + server.locals.config.publicHost);
			if (url.match(rx)) {
				url = url.replace(server.locals.config.publicHost, 'http://localhost:' + server.locals.config.port);
				debug('bypass proxy ' + url);
			}
		}
		return url;
	}
};
