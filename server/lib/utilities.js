var proxyEndPoint = require('./proxy-endpoint');
var request = require('request');
var async = require('async');
var VError = require('verror').VError;
var WError = require('verror').WError;
var url = require('url');

var defaultSettings = {
	'friendListVisibility': 'all', // all, mutual, none
	'feedSortOrder': 'activity', // post, activity
	'notifications_posts': 'on',
	'notifications_comments': 'on',
	'notifications_reactions': 'on',
	'notifications_digest': false,
	'notifications_friend_request': true
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

module.exports.whoAbout = function (endpoint, user, noproxy) {
	endpoint = endpoint.replace(/\/post\/.*/, '');
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

module.exports.getEndPointJSON = function getEndPointJSON(server, endpoint, currentUser, friend, options, done) {
	if (!endpoint) {
		return done(new Error('getEndPointJSON: endpoint not defined'));
	}

	var parsed = url.parse(endpoint);
	var path = parsed.pathname;

	var proxyHost = server.locals.config.publicHost;

	if (process.env.BEHIND_PROXY === 'true') {
		var rx = new RegExp('^' + server.locals.config.publicHost);
		if (proxyHost.match(rx)) {
			proxyHost = proxyHost.replace(server.locals.config.publicHost, 'http://localhost:' + server.locals.config.port);
		}
	}

	endpoint = proxyHost + path + '.json';

	/*
	var params = [];
	if (options.embed) {
		params.push('embed=1');
	}
	if (options.json) {
		params.push('format=json');
	}
	endpoint += '?' + params.join('&');
	*/

	async.waterfall([
		function (cb) { // need to get self access token
			currentUser.getSelfToken(function (err, token) {
				cb(null, token);
			});
		},
		function (token, cb) { // make the request
			var requestOptions = {
				'url': endpoint,
				'headers': {
					'access_token': token
				}
			};

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
