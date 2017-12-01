module.exports = function () {
	return function contextInitialized(req, res, next) {
		var reqContext = req.getCurrentContext();
		req.app.models.MyUser.find(function (err, users) {
			if (err) {
				return next(err);
			}
			reqContext.set('nodeIsInitialized', users.length ? users[0] : false);
			next();
		});
	};
};
