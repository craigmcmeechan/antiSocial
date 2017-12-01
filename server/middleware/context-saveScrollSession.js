var async = require('async');
var request = require('request');
var VError = require('verror');
var cache = require('../lib/cache');
var uuid = require('uuid');
var debug = require('debug')('pagination');
var debugVerbose = require('debug')('pagination:verbose');

module.exports = function () {
	return function contextSaveScrollSession(req, res, next) {
		var reqContext = req.getCurrentContext();

		if (!reqContext.get('scrollSessionId')) {
			debug('contextSaveScrollSession: no scrollSessionId');
			return next();
		}

		debug('contextSaveScrollSession:', reqContext.get('scrollSessionId'));
		cache.put('scrollSession', reqContext.get('scrollSessionId'), reqContext.get('scrollSession'), function (err) {
			next();
		});
	};
};
