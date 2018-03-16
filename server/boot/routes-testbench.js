var getCurrentUser = require('../middleware/context-currentUser');
var watchFeed = require('../lib/watchFeed');

module.exports = function (server) {
	var router = server.loopback.Router();

	// testbench
	router.get('/testbench', getCurrentUser(), function (req, res, next) {
		var ctx = req.myContext;

		res.render('pages/testbench', {
			'globalSettings': ctx.get('globalSettings'),
			'currentUser': ctx.get('currentUser'),
			'connections': watchFeed.connections
		});
	});

	server.use(router);
};
