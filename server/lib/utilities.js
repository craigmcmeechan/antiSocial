var proxyEndPoint = require('./proxy-endpoint');
var encryption = require('./encryption');
var request = require('request');
var async = require('async');
var server = require('../server');

var defaultSettings = {
	'friendListVisibility': 'all', // all, mutual, none
	'feedSortOrder': 'activity' // post, activity
};

module.exports.fixNameYou = function fixNameYou(endpoint, myendpoint, name, your) {
	if (endpoint === myendpoint) {
		if (your) {
			return 'your';
		}
		return 'you';
	}
	if (your) {
		return name + '\'s';
	}
	return name;
};

module.exports.kindOfThing = function kindOfThing(about) {
	var kind = 'post';
	if (about.match('/post/')) {
		if (about.match('/photo/')) {
			kind = 'photo';
		}
		if (about.match('/comment/')) {
			kind = 'comment';
		}
	}
	return kind;
};

module.exports.whatAbout = function (endpoint, user) {
	endpoint = endpoint.replace(/\/photo\/.*/, '');
	endpoint = endpoint.replace(/\/comment\/.*/, '');
	endpoint = proxyEndPoint(endpoint, user);
	return (endpoint);
};

module.exports.getUserSettings = function (user, cb) {

	server.models.Settings.findOne({
		'where': {
			'group': user.username
		}
	}, function (err, settings) {
		cb(err, settings ? settings.settings : defaultSettings);
	});
};

module.exports.friendEndPoint = function (endpoint, currentUser, friend, done) {

	var myEndPoint = server.locals.config.publicHost.PUBLIC_HOST + '/' + currentUser.username;
	var isMine = false;
	var re = new RegExp('^' + myEndPoint);

	if (endpoint.match(re)) {
		isMine = true;
	}

	// get it from remote endpoint
	var options = {
		'url': endpoint + '.json',
		'json': true,
		'headers': {
			'proxy': true
		}
	};


	if (friend) {
		options.headers['friend-access-token'] = friend.remoteAccessToken;
	}


	// if connecting to ourself behind a proxy don't use publicHost
	if (process.env.BEHIND_PROXY === 'true') {
		var rx = new RegExp('^' + server.locals.config.publicHost);
		if (options.url.match(rx)) {
			options.url = options.url.replace(server.locals.config.publicHost, 'http://localhost:' + server.locals.config.port);
		}
	}

	async.waterfall([
		function (cb) { // if accessing self get self access token
			if (!isMine) {
				return cb();
			}
			currentUser.getSelfToken(function (err, token) {
				options.headers['access_token'] = token;
				cb();
			});
		},
		function (cb) { // make the request
			request.get(options, function (err, response, body) {
				if (err) {
					return cb(err);
				}
				if (response.statusCode !== 200) {
					return cb(new Error(response.statusCode));
				}

				var data = body.data;
				if (friend && body.sig) {
					var privateKey = friend.keys.private;
					var publicKey = friend.remotePublicKey;
					var toDecrypt = body.data;
					var sig = body.sig;
					var pass = body.pass;
					var decrypted = encryption.decrypt(publicKey, privateKey, toDecrypt, pass, sig);
					if (!decrypted.valid) {
						return cb(new Error('encryption error'));
					}
					data = JSON.parse(decrypted.data);
				}

				cb(null, data);
			});
		}
	], function (err, data) {
		done(err, data);
	});
};
