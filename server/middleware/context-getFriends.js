// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var resolveProfiles = require('../lib/resolveProfiles');
var async = require('async');

module.exports = function () {
	return function contextFriends(req, res, next) {
		var reqContext = req.getCurrentContext();
		var user = reqContext.get('currentUser');

		if (!user) {
			return next();
		}

		var query = {
			'where': {
				'userId': user.id
			}
		};
		req.app.models.Friend.find(query, function (err, friends) {
			if (err) {
				return next(err);
			}

			async.each(friends, function (friend, cb) {
				resolveProfiles(friend, cb);
			}, function (err) {
				//console.log('%j',friends);
				reqContext.set('friends', friends);
				next();
			});
		});
	};
};
