// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

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
