var url = require('url');
var checkProxyRE = /^\/([a-zA-Z0-9-]+)(\/[^/]+)?/;
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');
var config = require('../config-' + process.env.NODE_ENV);

module.exports = function proxyEndPoint(endpoint, currentUser, embed) {
	if (!endpoint) {
		return;
	}

	var parsed = url.parse(endpoint);

	var path = parsed.pathname;

	var matches = path.match(checkProxyRE);

	if (matches && matches.length > 1) {

		var friendUsername = matches[1];
		var userEndpoint = parsed.protocol + '//' + parsed.host + '/' + friendUsername;

		if (currentUser) {
			if (currentUser.username === friendUsername) {
				var unproxied = parsed.pathname;
				debug('proxyEndPoint me ' + unproxied);
				if (embed) {
					unproxied += '?embed=1';
				}
				return unproxied;
			}
			for (var i = 0; i < currentUser.friends().length; i++) {
				var friend = currentUser.friends()[i];
				if (friend.remoteEndPoint === userEndpoint) {
					var unproxied = parsed.pathname;

					// use uniqued username for local request url form
					unproxied = unproxied.replace(/^\/[a-zA-Z0-9-]+/, '/' + friend.uniqueRemoteUsername);

					debug('proxyEndPoint friend found ' + unproxied);
					if (embed) {
						unproxied += '?embed=1';
					}
					return unproxied;
				}
			}
			debug('proxyEndPoint friend not found ' + endpoint);
		}
		else {
			debug('proxyEndPoint not logged in ' + endpoint);
		}
	}

	if (process.env.BEHIND_PROXY === "true") {
		var rx = new RegExp('^' + config.publicHost);
		if (endpoint.match(rx)) {
			endpoint = endpoint.replace(config.publicHost, 'http://localhost:' + config.port);
			debug('bypass proxy ' + endpoint);
		}
	}

	var proxied = getProxyForm(endpoint, matches);
	debug('proxyEndPoint default to proxy form: ' + proxied);
	if (embed) {
		proxied += '&embed=1';
	}
	return proxied;
};

function getProxyForm(endpoint, matches) {
	var view = matches.length > 2 && matches[2] ? matches[2].substr(1) : 'profile';
	return '/proxy-' + view + '?endpoint=' + encodeURIComponent(endpoint);
}
