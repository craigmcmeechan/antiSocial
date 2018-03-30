var debug = require('debug')('authentication');
var async = require('async');

module.exports = function () {
	return function contextCurrentUser(req, res, next) {
		if (!req.accessToken) {
			debug('no accessToken');
			return next();
		}

		var reqContext = req.getCurrentContext();

		req.app.models.MyUser.findById(req.accessToken.userId, {
			include: ['uploads', 'identities', 'friends']
		}, function (err, user) {

			if (err) {
				debug('no user found for ', req.accessToken);
				return next(err);
			}

			if (!user) {
				// user not found for accessToken, which is very odd.
				// behave like they are not logged in
				return next();
			}

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
					var q = {
						'where': {
							'group': user.username
						}
					};

					req.app.models.Settings.findOne(q, function (err, group) {
						var settings;
						if (group) {
							settings = group.settings;
						}
						if (!settings) {
							settings = {
								'friendListVisibility': 'all', // all, mutual, none
								'feedSortOrder': 'activity' // post, activity
							};
						}
						reqContext.set('userSettings', settings);
						cb();
					});
				}
			], function (err) {
				next();
			});
		});
	};
};
