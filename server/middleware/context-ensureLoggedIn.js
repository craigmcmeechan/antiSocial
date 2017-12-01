var loopback = require('loopback');

module.exports = function () {
	return function ensureLoggedIn(req, res, next) {
		var reqContext = req.getCurrentContext();
		if (!reqContext.get('currentUser')) {
			res.set('x-digitopia-hijax-flash-level','warning');
			res.set('x-digitopia-hijax-flash-message','Not Logged In');
			if (req.headers['x-digitopia-hijax']) {
				return res.set('x-digitopia-hijax-location', '/').send('redirect to ' + '/');
			}
			res.redirect('/');
		}
		else {
			next();
		}
	};
};
