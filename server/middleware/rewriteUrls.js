// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var checkProxyRE = /^\/([a-zA-Z0-9\-]+)/;
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');
var url = require('url');
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');

module.exports = function (view) {
	return function rewriteUrls(req, res, next) {

		var ctx = req.myContext;
		var matches = req.url.match(checkProxyRE);

		// bad url
		if (!matches) {
			return next();
		}

		var currentUser = ctx.get('currentUser');

		// not logged in
		if (!currentUser) {
			return next();
		}

		var username = matches[1];

		req.app.models.MyUser.findOne({
			'where': {
				'username': username
			},
			'include': ['uploads']
		}, function (err, user) {
			if (err) {
				return next(err);
			}

			// if user is found it is the currentUser, no proxy needed.
			if (user && user.id.toString() === currentUser.id.toString()) {
				debug('rewriteUrls /user/ is current user');
				return next();
			}

			// try to find Friend instance

			var query = {
				'where': {
					'and': [{
						'userId': currentUser.id
					}, {
						'uniqueRemoteUsername': username
					}]
				}
			};

			req.app.models.Friend.findOne(query, function (err, friend) {
				if (err) {
					return next(err);
				}
				if (!friend) {
					debug('rewriteUrls friend of currentUser matching /user/ not found');
					return next();
				}
				var rewrite = url.parse(req.url).pathname;

				// use username for remote request
				rewrite = rewrite.replace(/^\/[a-zA-Z0-9-]+/, '/' + friend.remoteUsername);

				if (rewrite.match(/\.json$/)) {
					rewrite = rewrite.replace(/\.json$/, '');
					req.query.format = 'json';
				}
				req.query.endpoint = friend.remoteHost + rewrite;
				req.url = '/proxy-' + view;
				ctx.set('redirectProxy', true);
				debug('rewriteUrls found friend of currentUser matching /user/ rewite url in proxy form:', req.url, req.query.endpoint);

				return next();
			});
		});
	};
};
