// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var async = require('async');

module.exports = function () {
	return function contextGetNewsFeedItem(req, res, next) {
		var reqContext = req.getCurrentContext();
		var user = reqContext.get('currentUser');

		if (!user) {
			return next();
		}

		var query = {
			'where': {
				'userId': user.id
			},
			'include': ['friend']
		};

		req.app.models.NewsFeedItem.find(query, function (err, feed) {
			reqContext.set('newsFeed', feed);
			return next();
		});
	};
};
