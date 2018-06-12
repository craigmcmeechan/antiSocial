// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var VError = require('verror').VError;

module.exports = function () {
	return function contestPendingFriendRequests(req, res, next) {
		var reqContext = req.getCurrentContext();
		var user = reqContext.get('currentUser');

		if (!user) {
			return next();
		}

		req.app.models.Friend.find({
			'where': {
				'and': [{
					'status': 'pending'
				}, {
					'userId': user.id
				}]
			}
		}, function (err, pending) {
			if (err) {
				return next(new VError(err, 'error finding pending friend requests'));
			}
			reqContext.set('pendingFriendRequests', pending);
			next();
		});
	};
};
