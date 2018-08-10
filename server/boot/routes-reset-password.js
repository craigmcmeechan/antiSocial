// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var async = require('async');

module.exports = function (server) {
	var router = server.loopback.Router();

	router.post('/reset-password', function (req, res, next) {

		if (!req.body.reset || !req.body.password) {
			return res.sendStatus(401);
		}

		async.waterfall([
			function getToken(cb) {
				server.models.AccessToken.resolve(req.body.reset, function (err, token) {
					if (err) {
						return cb(err);
					}
					if (!token) {
						return cb(new Error('invalid token'));
					}
					cb(null, token);
				});
			},
			function getUser(token, cb) {
				server.models.MyUser.findById(token.userId, function (err, user) {
					if (err) {
						return cb(err);
					}
					if (!user) {
						return cb(new Error('invalid token'));
					}
					cb(null, user);
				});
			},
			function updateUser(user, cb) {
				user.updateAttribute('password', req.body.password, function (err, user) {
					cb(err, user);
				});
			}
		], function (err, user) {
			if (err) {
				return res.sendStatus(404);
			}
			res.header('x-digitopia-hijax-flash-level', 'info');
			res.header('x-digitopia-hijax-flash-message', 'password updated');
			res.sendStatus(200);
		});
	});

	server.use(router);
};
