// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var bodyParser = require('body-parser');

module.exports = function (server) {
	var router = server.loopback.Router();
	router.post('/csp-violation', bodyParser.json({
		'type': ['json', 'application/csp-report']
	}), function (req, res, next) {
		if (req.body) {
			server.locals.logger.error('CSP Violation: %j', req.body);
		}
		else {
			server.locals.logger.error('CSP Violation: No data received!');
		}
		res.sendStatus(204);
	});

	server.use(router);
};
