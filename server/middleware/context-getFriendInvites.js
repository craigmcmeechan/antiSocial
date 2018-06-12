// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var resolveProfiles = require('../lib/resolveProfiles');
var async = require('async');

module.exports = function () {
	return function contextFriendInvites(req, res, next) {
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
		req.app.models.Invitation.find(query, function (err, invites) {
			if (err) {
				return next(err);
			}
			reqContext.set('invites', invites);
			next();
		});
	};
};
