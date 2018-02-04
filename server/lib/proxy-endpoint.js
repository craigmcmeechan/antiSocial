var url = require('url');
var checkProxyRE = /^\/([a-zA-Z0-9-]+)(\/[^/]+)?/;
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');

module.exports = function proxyEndPoint(endpoint, currentUser, embed) {
	if (!endpoint) {
		return;
	}

	var path = url.parse(endpoint).pathname;

	var matches = path.match(checkProxyRE);

	if (matches && matches.length > 1) {

		var friendUsername = matches[1];

		if (currentUser) {
			if (currentUser.username === friendUsername) {
				var unproxied = url.parse(endpoint).pathname;
				debug('proxyEndPoint me ' + unproxied);
				if (embed) {
					unproxied += '?embed=1';
				}
				return unproxied;
			}
			for (var i = 0; i < currentUser.friends().length; i++) {
				var friend = currentUser.friends()[i];
				if (friend.remoteUsername === friendUsername) {
					var unproxied = url.parse(endpoint).pathname;
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
