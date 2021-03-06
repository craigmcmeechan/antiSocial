// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var async = require('async');
var request = require('request');
var app = require('../server');
var debug = require('debug')('resolve');

module.exports = function resolveProfiles(item, done) {
	debug('resolveProfiles ' + item.uuid);

	var myCache = app.locals.myCache;

	var endpoints = [];
	var profiles = {};

	if (item.source && endpoints.indexOf(item.source) === -1) {
		endpoints.push(item.source);
		profiles[item.source] = {};
	}

	if (item.remoteEndPoint && endpoints.indexOf(item.remoteEndPoint) === -1) {
		endpoints.push(item.remoteEndPoint);
		profiles[item.remoteEndPoint] = {};
	}

	if (item.about && endpoints.indexOf(item.about) === -1) {
		endpoints.push(item.about);
		profiles[item.about] = {};
	}

	if (item.target && endpoints.indexOf(item.target) === -1) {
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

		// if connecting to ourself behind a proxy don't use publicHost
		if (process.env.BEHIND_PROXY === "true") {
			var rx = new RegExp('^' + app.locals.config.publicHost);
			if (options.url.match(rx)) {
				options.url = options.url.replace(app.locals.config.publicHost, 'http://localhost:' + app.locals.config.port);
				debug('bypass proxy ' + options.url);
			}
		}

		request.get(options, function (err, response, body) {
			var payload = {};
			if (err || response.statusCode !== 200) {
				payload.status = 'could not load endpoint profile';
				payload.status = 503;
				if (response && response.statusCode) {
					payload.status = response.statusCode;
				}
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
						'url': app.locals.config.publicHost + '/images/slug.png'
					},
					'background': {
						'url': app.locals.config.publicHost + '/images/fpo.jpg'
					}
				};
			}
			else {
				payload.profile.photo.url = payload.profile.photo.url;
				payload.profile.background.url = payload.profile.background.url;
			}
			myCache.set('profile-' + whoAbout, payload, payload.status === 200 ? 1800 : 60);
			profiles[endpoint] = payload;
			cb();
		});
	}, function (err) {
		item.resolvedProfiles = profiles;
		done(err);
	});
};
