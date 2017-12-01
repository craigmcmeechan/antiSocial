module.exports = function () {
	return function contextFriendAccess(req, res, next) {
		var reqContext = req.getCurrentContext();
		var user = reqContext.get('currentUser');

		var accessToken = req.headers['friend-access-token'];

		if (!accessToken) {
			return next();
		}

		//console.log('have friend-access-token ', accessToken);

		req.app.models.Friend.findOne({
			'where': {
				'localAccessToken': accessToken
			}
		}, function (err, friend) {
			if (err || !friend) {
				return next();
			}
			if (friend.status !== 'accepted') {
				return next();
			}

			//console.log('found friend from friend-access-token',friend);

			reqContext.set('friendAccess', friend);
			next();
		});
	};
};
