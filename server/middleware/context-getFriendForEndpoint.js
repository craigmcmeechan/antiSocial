module.exports = function () {
	return function contextFriendAccess(req, res, next) {
		var reqContext = req.getCurrentContext();
		var user = reqContext.get('currentUser');
		if (!user) {
			return next();
		}
		if (!req.query.endpoint) {
			return next();
		}

		var endpoint = req.query.endpoint;
		endpoint = endpoint.replace(/\/post.*$/,'');

		var query = {
			'where': {
				'and': [{
					'userId': user ? user.id : ''
				}, {
					'remoteEndPoint': endpoint
				}]
			}
		};

		//console.log('contextFriendAccess %j', query);

		req.app.models.Friend.findOne(query, function (err, friend) {
			if (err) {
				return next(err);
			}
			//console.log('found friend:',friend);
			reqContext.set('friend', friend);
			next();
		});
	};
};
