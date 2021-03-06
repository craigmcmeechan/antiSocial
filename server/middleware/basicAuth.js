// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var basicAuth = require('basic-auth');

module.exports = function () {
	return function basicAuthMiddleware(req, res, next) {

		if (!req.url.match(/\/(api|explorer)\//)) {
			var user = basicAuth(req);

			if (!user || user.name !== process.env.BASIC_AUTH_USER_NAME || user.pass !== process.env.BASIC_AUTH_PASSWORD) {
				res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
				return res.sendStatus(401);
			}

			return next();
		}

		next();
	};
};
