const raven = require('raven');

if (process.env.RAVEN) {
	raven.config('https://ef63061ed04d46089284817e8aa9b37d:dedd16620dc84207b50475a5ef39a2d2@sentry.io/152485', {
		'autoBreadcrumbs': true
	}).install();
}

module.exports = function () {
	return function logError(err, req, res, next) {
		var ctx = req.getCurrentContext();
		var currentUser = ctx.get('currentUser');

		var userContext = {};

		if (currentUser) {
			userContext = {
				'user': {
					id: currentUser.id,
					username: currentUser.username,
					email: currentUser.email,
					ip_address: ctx.get('ip')
				}
			};

			if (process.env.RAVEN) {
				raven.setContext(userContext);
			}
		}
		if (process.env.RAVEN) {
			raven.captureException(err);
		}

		if(req.logger) {
			req.logger.error('Error %s %j %j', req, userContext, err);
		}
		else {
			console.log('Error %s %j %j', req, userContext, err);
		}

		next(err);
	};
};
