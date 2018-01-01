var url = require('url');

module.exports = function () {
	return function contextFriendAccess(req, res, next) {
		var reqContext = req.getCurrentContext();
		var user = reqContext.get('currentUser');
		var accessToken = req.headers['friend-access-token'];

		if (!accessToken && !user) {
			return next();
		}

		var query;

		//friend-access-token header is defined, look up friend
		if (accessToken) {
			query = {
				'where': {
					'localAccessToken': accessToken
				}
			}
		}
		else { // find Friend by endpoint for currentUser
			var endpoint = req.app.locals.config.publicHost + url.parse(req.url).pathname;
			endpoint = endpoint.replace(/\/post.*$/, '');
			endpoint = endpoint.replace(/\.json$/, '');

			query = {
				'where': {
					'and': [{
						'userId': user.id
					}, {
						'remoteEndPoint': endpoint
					}]
				}
			};
		}

		req.app.models.Friend.findOne(query, function (err, friend) {
			if (err || !friend) {
				return next();
			}
			if (friend.status !== 'accepted') {
				return next();
			}

			reqContext.set('friendAccess', friend);
			next();
		});
	};
};
