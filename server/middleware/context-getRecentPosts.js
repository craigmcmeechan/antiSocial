// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var async = require('async');

module.exports = function () {
	return function contextGetRecentPosts(req, res, next) {
		var reqContext = req.getCurrentContext();
		var user = reqContext.get('currentUser');

		if (!user) {
			return next();
		}

		req.app.models.Post.find({
			'where': {
				'userId': user.id
			},
			'order': 'createdOn DESC',
			'limit': 30,
			'include': [{
				'user': ['uploads']
			}, {
				'photos': ['uploads']
			}]
		}, function (err, posts) {
			if (err) {
				return next(err);
			}
			reqContext.set('recentPosts', posts);
			next();
		});
	};
};
