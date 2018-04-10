module.exports = function (server) {
	var router = server.loopback.Router();

	// testbench
	router.post('/reset-password', function (req, res, next) {
		if (!req.accessToken) return res.sendStatus(401);
		server.models.MyUser.findById(req.accessToken.userId, function (err, user) {
			if (err) {
				return res.sendStatus(404);
			}
			try {
				user.updateAttribute('password', req.body.password, function (err, user) {
					if (err) {
						return res.sendStatus(404);
					}
					res.header('x-digitopia-hijax-flash-level', 'info');
					res.header('x-digitopia-hijax-flash-message', 'password updated');
					res.sendStatus(200);
				});
			}
			catch (err) {
				console.log(err);
				res.sendStatus(500);
			}
		});
	});

	server.use(router);
};
