// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var debug = require('debug')('authentication');
var async = require('async');
var utils = require('../lib/utilities');

module.exports = function () {
	return function contextCurrentUser(req, res, next) {
		if (!req.accessToken) {
			debug('no accessToken');
			fixCookie(res);
			return next();
		}

		var reqContext = req.getCurrentContext();

		req.app.models.MyUser.findById(req.accessToken.userId, {
			'include': [
				'uploads',
				'subscriptions',
				'identities', {
					'relation': 'friends',
					'scope': {
						'where': {
							'status': 'accepted'
						}
					}
				}
			]
		}, function (err, user) {

			if (err) {
				debug('error finding user for token ', req.accessToken);
				fixCookie(res);
				return next(err);
			}

			if (!user) {
				// user not found for accessToken, which is very odd.
				// behave like they are not logged in
				debug('no user found for token ', req.accessToken);
				fixCookie(res);
				return next();
			}

			req.antisocialUser = user;
			reqContext.set('currentUser', user);
			reqContext.set('ip', req.ip);

			async.series([
				function (cb) {
					var q = {
						'where': {
							'principalType': req.app.models.RoleMapping.USER,
							'principalId': user.id
						},
						'include': ['role']
					};

					req.app.models.RoleMapping.find(q, function (err, roles) {
						reqContext.set('currentUserRoles', roles);
						cb();
					});
				},
				function (cb) {
					utils.getUserSettings(req.app, user, function (err, settings) {
						reqContext.set('userSettings', settings);
						cb();
					});
				}
			], function (err) {
				next();
			});
		});
	};

	function fixCookie(res) {
		res.clearCookie('access_token');
	}
};
