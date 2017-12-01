var NodeCache = require("node-cache");
var async = require('async');
var myCache = new NodeCache();
var request = require('request');

module.exports = function resolveProfiles(item, done) {
	var endpoints = [];
	var profiles = {};

	if (item.source) {
		endpoints.push(item.source);
		profiles[item.source] = {};
	}

	if (item.about) {
		endpoints.push(item.about);
		profiles[item.about] = {};
	}


	// console.log('resolving', item.source, item.about, item);

	async.each(endpoints, function (endpoint, cb) {

		var whoAbout = endpoint.replace(/\/post\/.*$/, '');

		var cached = myCache.get(endpoint);
		if (cached) {
			profiles[endpoint] = cached;
			return cb();
		}

		var options = {
			'url': whoAbout + '/profile.json',
			'json': true
		};

		request.get(options, function (err, response, body) {
			var payload = {};
			if (err) {
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
			//myCache.set(endpoint, payload, 86400);
			profiles[endpoint] = payload;
			cb();
		});
	}, function (err) {
		item.resolvedProfiles = profiles;
		done(err);
	});
};
