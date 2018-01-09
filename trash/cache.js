var debug = require('debug')('cache');
var debugVerbose = require('debug')('cache:verbose');

var cache = {};


module.exports.init = function (app) {};

module.exports.get = function (ns, key, callback) {
	debugVerbose('cache.get', ns, key);
	if (!cache[ns]) {
		cache[ns] = {};
	}

	if (cache[ns][key] && cache[ns][key].ttl) {
		debugVerbose('ttl found ', ns, key, cache[ns][key].ttl);
		if (cache[ns][key].ttl.set + cache[ns][key].ttl.ttl < new Date().getTime()) {
			delete cache[ns][key];
			debugVerbose('ttl expired');
		}
	}

	var value = null;
	if (cache[ns][key]) {
		value = JSON.parse(cache[ns][key].val);
	}
	if (callback) {
		return callback(null, value);
	}

	return value;
};

module.exports.put = function (ns, key, value, callback, ttl) {
	debugVerbose('cache.put', ns, key, value);

	if (!cache[ns]) {
		cache[ns] = {};
	}

	cache[ns][key] = {
		'val': JSON.stringify(value)
	};

	if (ttl) {
		cache[ns][key].ttl = {
			'ttl': ttl,
			'set': new Date().getTime()
		};
	}

	if (callback) {
		callback(null);
	}
};

module.exports.invalidate = function (ns, callback) {
	cache[ns] = {};
	if (callback) {
		callback(null);
	}
};
