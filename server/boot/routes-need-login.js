// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/need-login', function (req, res, next) {
		var ctx = req.myContext;

		res.render('pages/need-login', {
			'globalSettings': ctx.get('globalSettings'),
			'page': req.query.page
		});
	});

	server.use(router);
};
