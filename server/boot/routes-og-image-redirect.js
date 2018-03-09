var request = require('request');

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/linked-og-image', function (req, res, next) {
		var url = req.query.url;
		if (!url) {
			return res.sendStatus(400);
		}

		request.get({
			'url': server.locals.config.publicHost + '/api/OgTags/image?url=' + encodeURIComponent(url)
		}, function (err, response, body) {
			res.redirect(body.replace(/"/g, ''));
		});
	});

	server.use(router);
};
