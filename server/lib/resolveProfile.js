var request = require('request');
var debug = require('debug')('resolve');

module.exports = function resolveProfile(app, endpoint, done) {
	debug('resolveProfile ' + endpoint);

	var myCache = app.locals.myCache;
	var cached = myCache.get('profile-' + endpoint);
	if (cached) {
		return done(null, cached);
	}

	var options = {
		'url': endpoint + '.json',
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
		myCache.set('profile-' + endpoint, payload, payload.status === 200 ? 1800 : 60);
		done(null, payload);
	});
};
