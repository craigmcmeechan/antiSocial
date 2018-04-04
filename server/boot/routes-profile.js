var getCurrentUser = require('../middleware/context-currentUser');

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/profile', getCurrentUser(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		if (!currentUser) {
			return res.redirect('/');
		}

		res.set('x-digitopia-hijax-location', '/' + currentUser.username).send('redirect to ' + '/' + currentUser.username);
	});

	server.use(router);
};
