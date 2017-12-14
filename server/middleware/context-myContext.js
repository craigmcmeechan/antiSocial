var server = require('../server');

module.exports = function () {

	function ReqContext() {
		this.data = {};

		this.get = function (key) {
			return this.data[key];
		};

		this.set = function (key, value) {
			this.data[key] = value;
			if (server.raven) {
				server.raven.captureBreadcrumb({
					'category': 'setContext',
					'data': {
						'key': key,
						'value': value
					}
				});
			}
		};

		this.cleanup = function () {
			this.data = {};
		};
	}

	return function myContext(req, res, next) {
		res.once('finish', function () {
			req.myContext.cleanup();
		});
		req.myContext = new ReqContext();
		req.myContext.set('originalUrl', req.originalUrl);
		req.myContext.set('ip', req.ip);
		req.getCurrentContext = function () {
			return req.myContext;
		};
		next();
	};
};
