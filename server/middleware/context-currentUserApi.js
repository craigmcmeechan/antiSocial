// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

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
