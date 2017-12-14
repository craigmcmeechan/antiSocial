var getCurrentUser = require('../middleware/context-currentUser');
var VError = require('verror').VError;
var WError = require('verror').WError;

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/ping', getCurrentUser(), function (req, res, next) {
		req.logger.error({
			'req': req,
			'yo': 'yoyo'
		}, 'Yo! an Error');

		var cause = new Error('the culprit');
		var e = new VError(cause, 'ack! an error!');
		var ee = new WError(e);

		req.logger.error(e);

		req.logger.error(ee);


		throw ('wtf?');
		res.send('ok');
	});

	server.use(router);
};
