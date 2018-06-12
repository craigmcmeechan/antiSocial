// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function () {
	return function contextPublicUsers(req, res, next) {
		var reqContext = req.getCurrentContext();
		var currentUser = reqContext.get('currentUser');

		var query = {
			'where': {
				'and': []
			}
		}

		query.where.and.push({
			'discoverable': true
		});

		if (currentUser) {
			query.where.and.push({
				'id': {
					'neq': currentUser.id
				}
			});

		}

		req.app.models.MyUser.find(query, function (err, users) {
			if (err) {
				return next(err);
			}
			reqContext.set('publicUsers', users);
			next();
		});
	};
};
