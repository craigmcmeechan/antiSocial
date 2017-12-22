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

		if (accessToken) {
			query = {
				'where': {
					'localAccessToken': accessToken
				}
			}
		}
		else {
			var endpoint = req.app.locals.config.publicHost + url.parse(req.url).pathname;
			endpoint = endpoint.replace(/\/post.*$/, '');

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
