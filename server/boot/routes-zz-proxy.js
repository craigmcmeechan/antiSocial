var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');
var getFriendForEndpoint = require('../middleware/context-getFriendForEndpoint');
var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var encryption = require('../lib/encryption');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var request = require('request');
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');
var AWSXray = require('aws-xray-sdk');

module.exports = function (server) {
	var router = server.loopback.Router();

	if (process.env.XRAY) {
		AWSXray.express.openSegment('myAntiSocial/proxy');
	}

	var proxyRE = /^\/proxy\-(post-comments|post\-photos|post\-photo|post-photo-comments|profile|posts|post|reactions|reaction|comments|comment|photos|photo|friends)/;

	function getPOVEndpoint(currentUser) {
		if (currentUser) {
			return server.locals.config.publicHost + '/' + currentUser.username;
		}
	}

	// TODO should this require logged in user? probably

	router.get(proxyRE, getCurrentUser(), getFriendForEndpoint(), function (req, res, next) {

		var ctx = req.myContext;
		var endpoint = req.query.endpoint;
		var json = req.query.format === 'json';
		var logger = req.logger;

		var matches = req.url.match(proxyRE);

		var template = matches[1];
		var currentUser = ctx.get('currentUser');
		var friend = ctx.get('friend');

		if (!endpoint) {
			return res.sendStatus(400);
		}

		if (template === 'profile' && !json) {
			endpoint += '/posts';
		}

		var isMe = false;
		if (currentUser) {
			var myEndpoint;

			myEndpoint = server.locals.config.publicHost + '/' + currentUser.username;
			if (endpoint.match(new RegExp('^' + myEndpoint))) {
				debug('proxy: endpoint is same as logged in user');
				isMe = true;
			}
		}

		var options = {
			'url': endpoint + '.json',
			'json': true,
			'headers': {
				'proxy': true
			}
		};

		var query = [];

		if (req.query.more) {
			query.push('more=1');
			if (req.query.highwater) {
				query.push('highwater=' + req.query.highwater);
			}
		}

		if (req.query.tags) {
			query.push('tags=' + req.query.tags);
		}

		if (template === 'friends') {
			var hashes = [];
			for (var i = 0; i < currentUser.friends().length; i++) {
				hashes.push(currentUser.friends()[i].hash);
			}
			query.push('hashes=' + hashes.join(','));
		}

		if (query.length) {
			options.url += '?' + query.join('&');
		}

		if (friend) {
			options.headers['friend-access-token'] = friend.remoteAccessToken;
		}
		else {
			if (req.signedCookies.access_token) {
				options.headers['access_token'] = req.signedCookies.access_token;
			}
		}

		debug('proxy request: %j', options);

		request.get(options, function (err, response, body) {
			if (err) {
				var e = new VError(err, 'could not load endpoint ' + endpoint);
				logger.error('proxy error %s %j', endpoint, e);
				return res.status(response && response.statusCode ? response.statusCode : 500).send(e.message);
			}
			if (response.statusCode !== 200) {
				return res.sendStatus(response.statusCode);
			}

			var data = body;

			if (friend && body.sig) {
				debug('got encrypted response');
				var privateKey = friend.keys.private;
				var publicKey = friend.remotePublicKey;
				var toDecrypt = body.data;
				var sig = body.sig;
				var pass = body.pass;

				var decrypted = encryption.decrypt(publicKey, privateKey, toDecrypt, pass, sig);
				if (!decrypted.valid) {
					return res.sendStatus('401');
				}

				data = JSON.parse(decrypted.data);
			}

			res.header('x-highwater', data.highwater);

			if (json) {
				data.pov.proxy = {
					'endpoint': options.url,
					'encrypted-response': friend && body.sig ? true : false
				};
				res.send(data);
			}
			else {
				var isPermalink = false;
				if (template === 'post' && !req.query.embed) {
					isPermalink = true;
				}

				var friendMap = {};
				if (currentUser && currentUser.friends()) {
					for (var i = 0; i < currentUser.friends().length; i++) {
						var f = currentUser.friends()[i];
						friendMap[f.remoteEndPoint] = f;
					}
				}

				res.render('components/rendered-' + template, {
					'globalSettings': ctx.get('globalSettings'),
					'userSettings': ctx.get('userSettings'),
					'data': data,
					'friend': friend,
					'user': currentUser,
					'wall': true,
					'isMe': isMe,
					'myEndpoint': getPOVEndpoint(currentUser),
					'wantSummary': template === 'comment',
					'isPermalink': isPermalink,
					'friendMap': friendMap,
					'cache': process.env.NODE_ENV === 'production' ? true : false
				});
			}
		});
	});

	if (process.env.XRAY) {
		AWSXray.express.closeSegment();
	}

	server.use(router);
};
