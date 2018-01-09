var async = require('async');
var request = require('request');
var app = require('../server');
var debug = require('debug')('cache');

module.exports = function resolveProfiles(item, done) {
	var myCache = app.locals.myCache;

	var endpoints = [];
	var profiles = {};

	if (item.source) {
		endpoints.push(item.source);
		profiles[item.source] = {};
	}

	if (item.remoteEndPoint) {
		endpoints.push(item.remoteEndPoint);
		profiles[item.remoteEndPoint] = {};
	}

	if (item.about) {
		endpoints.push(item.about);
		profiles[item.about] = {};
	}

	if (item.target) {
		endpoints.push(item.target);
		profiles[item.target] = {};
	}


	// console.log('resolving', item.source, item.about, item);

	async.each(endpoints, function (endpoint, cb) {

		var whoAbout = endpoint.replace(/\/post\/.*$/, '');

		var cached = myCache.get('profile-' + whoAbout);
		if (cached) {
			debug('got ' + whoAbout + ' from cache ' + endpoint);
			profiles[endpoint] = cached;
			return cb();
		}

		var options = {
			'url': whoAbout + '.json',
			'json': true
		};

		request.get(options, function (err, response, body) {
			var payload = {};
			if (err || response.statusCode !== 200) {
				payload.status = 'could not load endpoint profile';
			}
			else {
				payload.status = response.statusCode;
				payload.profile = body.profile;
			}

			//console.log(payload.profile);

			if (!payload.profile) {
				payload.profile = {
					'endpoint': endpoint,
					'name': 'unknown',
					'photo': {
						'url': '/images/slug.png'
					},
					'background': {
						'url': '/images/fpo.jpg'
					}
				};
			}
			else {
				payload.profile.photo.url = payload.profile.photo.url;
				payload.profile.background.url = payload.profile.background.url;
			}
			myCache.set('profile-' + whoAbout, payload, 3600);
			profiles[endpoint] = payload;
			cb();
		});
	}, function (err) {
		item.resolvedProfiles = profiles;
		done(err);
	});
};
