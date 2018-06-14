// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var loopback = require('loopback');

module.exports = function () {
	return function ensureLoggedIn(req, res, next) {
		var reqContext = req.getCurrentContext();
		if (!reqContext.get('currentUser')) {
			res.set('x-digitopia-hijax-flash-level', 'warning');
			res.set('x-digitopia-hijax-flash-message', 'Not Logged In');
			if (req.headers['x-digitopia-hijax']) {
				return res.set('x-digitopia-hijax-location', '/need-login?page=' + encodeURIComponent(req.url)).send('redirect to ' + '/');
			}
			res.redirect('/need-login?page=' + encodeURIComponent(req.url));
		}
		else {
			next();
		}
	};
};
