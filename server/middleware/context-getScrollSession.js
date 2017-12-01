var async = require('async');
var request = require('request');
var VError = require('verror');
var cache = require('../lib/cache');
var uuid = require('uuid');
var debug = require('debug')('pagination');
var debugVerbose = require('debug')('pagination:verbose');

module.exports = function () {
	return function contextGetScrollSession(req, res, next) {
		var reqContext = req.getCurrentContext();

		if (!req.query.more || !req.cookies.scrollSessionId || !cache.get('scrollSession', req.cookies.scrollSessionId)) {
			reqContext.set('scrollSessionId', uuid());
			reqContext.set('scrollSession', {
				'page': 0,
				'highwater': {},
				'posts': {}
			});

			res.cookie('scrollSessionId', reqContext.get('scrollSessionId'), {
				path: '/feed'
			});

			debug('contextGetScrollSession: new session');
			return next();
		}

		reqContext.set('scrollSessionId', req.cookies.scrollSessionId);
		cache.get('scrollSession', req.cookies.scrollSessionId, function (err, data) {
			++data.page;
			reqContext.set('scrollSession', data);
			debug('contextGetScrollSession: found', reqContext.get('scrollSessionId'), reqContext.get('scrollSession'));
			next();
		});
	};
};
