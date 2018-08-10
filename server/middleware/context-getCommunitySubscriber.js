// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function () {
	return function contextCommunitySubscriber(req, res, next) {
		var reqContext = req.getCurrentContext();
		var accessToken = req.headers['community-access-token'];

		if (!accessToken) {
			return next();
		}

		var query = {
			'where': {
				'and': [{
					'localAccessToken': accessToken
				}]
			},
			'include': ['user']
		};

		req.app.models.Subscription.findOne(query, function (err, subscriber) {
			if (err || !subscriber) {
				return next();
			}

			if (subscriber.status !== 'accepted') {
				return next();
			}

			reqContext.set('communitySubscriber', subscriber);
			next();
		});
	};
};
