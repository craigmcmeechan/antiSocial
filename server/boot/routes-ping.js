module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/ping', function (req, res, next) {
		res.send('ok');
	});

	server.use(router);
};
