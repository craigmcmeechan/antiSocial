var proxyEndPoint = require('./proxy-endpoint');
var request = require('request');
var async = require('async');
var VError = require('verror').VError;
var WError = require('verror').WError;

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

module.exports.whatAbout = function (endpoint, user, noproxy) {
	endpoint = endpoint.replace(/\/photo\/.*/, '');
	endpoint = endpoint.replace(/\/comment\/.*/, '');
	if (!noproxy) {
		endpoint = proxyEndPoint(endpoint, user);
	}
	return (endpoint);
};

module.exports.getUserSettings = function (server, user, cb) {
	server.models.Settings.findOne({
		'where': {
			'group': user.username
		}
	}, function (err, settings) {
		cb(err, settings ? settings.settings : defaultSettings);
	});
};

module.exports.getEndPoint = function (server, endpoint, currentUser, friend, options, done) {

	endpoint = proxyEndPoint(endpoint, currentUser, options);
	var proxyHost = server.locals.config.publicHost;

	if (process.env.BEHIND_PROXY === 'true') {
		var rx = new RegExp('^' + server.locals.config.publicHost);
		if (proxyHost.match(rx)) {
			proxyHost = proxyHost.replace(server.locals.config.publicHost, 'http://localhost:' + server.locals.config.port);
		}
	}

	async.waterfall([
		function (cb) { // need to get self access token
			currentUser.getSelfToken(function (err, token) {
				cb(null, token);
			});
		},
		function (token, cb) { // make the request
			var requestOptions = {
				'url': proxyHost + endpoint,
				'headers': {
					'access_token': token
				}
			};

			console.log('getEndPoint', requestOptions);

			request.get(requestOptions, function (err, response, body) {
				if (err) {
					var e = new VError(err, 'could not load endpoint ' + endpoint);
					return cb(e.message);
				}
				if (response.statusCode !== 200) {
					err = new Error('error ' + response.statusCode);
					err.statusCode = 404;
					return cb(err);
				}

				if (options.json) {
					body = JSON.parse(body);
				}
				cb(null, body);
			});
		}
	], function (err, data) {
		done(err, data);
	});
};
