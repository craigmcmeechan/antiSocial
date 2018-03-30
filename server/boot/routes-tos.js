module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/terms', function (req, res, next) {
		var ctx = req.myContext;

		res.render('pages/terms-privacy', {
			'globalSettings': ctx.get('globalSettings'),
		});
	});

	server.use(router);
};
