// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function () {
	return function errorHandler(err, req, res, next) {
		var ctx;
		var currentUser;
		if (req.getCurrentContext) {
			ctx = req.getCurrentContext();
			currentUser = ctx.get('currentUser');
		}
		var userContext = {};

		if (currentUser) {
			userContext = {
				id: currentUser.id,
				username: currentUser.username,
				email: currentUser.email,
				ip: ctx.get('ip')
			};
		}

		if (req.logger) {
			req.logger.error({
				'req': req,
				'user': userContext,
				'err': err
			}, 'errorHandler');
		}
		else {
			console.log('Error %s %j %j', req.url, userContext, err);
		}

		next(err);
	};
};
