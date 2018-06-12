// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

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
