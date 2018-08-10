var pug = require('pug');

module.exports = function (server) {
	var router = server.loopback.Router();

	var re = /template\/(.*)/
	router.get(re, function (req, res, next) {
		var matches = req.url.match(re);
		var code = pug.compileFileClient(matches[1], {
			'debug': false,
			'name': req.query.name
		});
		res.send(code);
	});

	server.use(router);
};
