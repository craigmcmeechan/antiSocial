// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function () {
	return function contextCommunityAccess(req, res, next) {
		var reqContext = req.getCurrentContext();
		var accessToken = req.headers['community-access-token'];

		if (!accessToken) {
			return next();
		}

		var communityRE = /^\/community\/([a-zA-Z0-9-]+)(\.json)?$/;
		var matches = req.url.match(communityRE);

		req.app.models.Community.findOne({
			'where': {
				'nickname': matches[1]
			}
		}, function (err, community) {
			if (err || !community) {
				return next();
			}

			var query = {
				'where': {
					'and': [{
						'communityId': community.id,
						'localAccessToken': accessToken
					}]
				}
			};

			req.app.models.Member.findOne(query, function (err, member) {
				if (err || !member) {
					return next();
				}

				if (member.status !== 'accepted') {
					return next();
				}

				reqContext.set('communityMember', member);
				next();
			});
		});
	};
};
