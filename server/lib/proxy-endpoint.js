// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var url = require('url');
var checkProxyRE = /^\/([a-zA-Z0-9-]+)(\/[^/]+)?/;
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');
var config = require('../config-' + process.env.NODE_ENV);

module.exports = function proxyEndPoint(endpoint, currentUser, options) {
	if (!endpoint) {
		return;
	}
	if (!options) {
		options = {};
	}

	var parsed = url.parse(endpoint);

	var path = parsed.pathname;

	var matches = path.match(checkProxyRE);

	if (!options.forceProxy) {
		if (matches && matches.length > 1) {

			var friendUsername = matches[1];
			var userEndpoint = parsed.protocol + '//' + parsed.host + '/' + friendUsername;

			if (currentUser) {
				if (currentUser.username === friendUsername) {
					var unproxied = parsed.pathname;
					if (options.json) {
						unproxied += '.json';
					}
					if (options.embed) {
						unproxied += '?embed=1';
					}

					debug('proxyEndPoint me ' + unproxied);

					return unproxied;
				}

				if (currentUser.friends && currentUser.friends()) {
					for (var i = 0; i < currentUser.friends().length; i++) {
						var friend = currentUser.friends()[i];
						if (friend.remoteEndPoint === userEndpoint) {
							var unproxied = parsed.pathname;

							// use uniqued username for local request url form
							unproxied = unproxied.replace(/^\/[a-zA-Z0-9-]+/, '/' + friend.uniqueRemoteUsername);

							if (options.json) {
								unproxied += '.json';
							}
							if (options.embed) {
								unproxied += '?embed=1';
							}

							debug('proxyEndPoint friend found ' + unproxied);

							return unproxied;
						}
					}
					debug('proxyEndPoint friend not found ' + endpoint);
				}
			}
			else {
				debug('proxyEndPoint not logged in ' + endpoint);
			}
		}
	}

	if (process.env.BEHIND_PROXY === "true") {
		var rx = new RegExp('^' + config.publicHost);
		if (endpoint.match(rx)) {
			endpoint = endpoint.replace(config.publicHost, 'http://localhost:' + config.port);
			debug('bypass proxy ' + endpoint);
		}
	}

	var proxied = getProxyForm(endpoint, matches, options);
	debug('proxyEndPoint default to proxy form: ' + proxied);
	var query = getParams(options);
	if (query) {
		proxied += '&' + query;
	}
	return proxied;
};

function getParams(options) {
	var params = [];
	if (options.embed) {
		params.push('embed=1');
	}
	if (options.json) {
		params.push('format=json');
	}
	return params.join('&');
}

function getProxyForm(endpoint, matches, options) {
	var view = matches.length > 2 && matches[2] ? matches[2].substr(1) : 'profile';
	if (options.view) {
		view = options.view;
	}
	return '/proxy-' + view + '?endpoint=' + encodeURIComponent(endpoint);
}
