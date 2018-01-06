var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');
var getFriendForEndpoint = require('../middleware/context-getFriendForEndpoint');
var getCurrentUser = require('../middleware/context-currentUser');
var encryption = require('../lib/encryption');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var request = require('request');
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');

module.exports = function (server) {
	var router = server.loopback.Router();

	var proxyRE = /^\/proxy\-(post\-reactions|post\-comments|post\-comment\-reactions|post\-comment|post\-photos|post\-photo\-reactions|post\-photo\-comments|post\-photo\-comment\-reactions|post\-photo\-comment|post\-photo|profile|posts|post)/;

	function getPOVEndpoint(currentUser) {
		if (currentUser) {
			return server.locals.config.publicHost + '/' + currentUser.username;
		}
	}

	router.get(proxyRE, getCurrentUser(), getFriendForEndpoint(), function (req, res, next) {

		var ctx = req.myContext;
		var endpoint = req.query.endpoint;
		var json = req.query.format === 'json';

		var matches = req.url.match(proxyRE);

		var template = matches[1];
		var currentUser = ctx.get('currentUser');
		var friend = ctx.get('friend');

		if (!endpoint) {
			return res.sendStatus(400);
		}

		if (template === 'profile') {
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
			'headers': {}
		};

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
				return next(e);
			}
			if (response.statusCode !== 200) {
				return res.sendStatus(response.statusCode);
			}

			var data = body;

			if (friend && body.sig) {
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

			if (json) {
				res.send(data);
			}
			else {
				var isPermalink = false;
				if (template === 'post') {
					isPermalink = true;
				}
				res.render('components/rendered-' + template, {
					'globalSettings': ctx.get('globalSettings'),
					'data': data,
					'friend': friend,
					'user': currentUser,
					'wall': true,
					'isMe': isMe,
					'myEndpoint': getPOVEndpoint(currentUser),
					'wantSummary': template === 'post-comment',
					'isPermalink': isPermalink
				});
			}
		});
	});

	server.use(router);
};
