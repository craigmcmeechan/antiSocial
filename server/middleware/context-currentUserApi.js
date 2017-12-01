var getCurrentUser = require('./context-currentUser')();

module.exports = function () {
	return function contextCurrentUserApi(req, res, next) {
		if (req.path.match(/^\/api\//)) {
			getCurrentUser(req, res, next);
		}
		else {
			next();
		}
	};
};
