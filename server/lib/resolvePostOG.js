var async = require('async');
var server = require('../server');
var crc = require('crc');


module.exports = function resolvePostOg(posts, done) {

	var OgMap = {};

	async.map(posts, function (post, cb) {
		//find all [](xxx) urls in body

		if (!post || !post.body) {
			return cb();
		}

		var matches = post.body.match(/\[\]\(([^)]*)\)/g);

		if (!matches) {
			return cb();
		}

		async.map(matches, function (found, cbMatches) {
			found = found.replace(/\[\]\(([^)]*)\)/, '$1');
			server.models.OgTag.findOne({
				'where': {
					'url': found
				},
				'include': ['uploads']
			}, function (err, og) {
				if (!err && og) {
					og.hash = hash(og.url);
					OgMap[found] = og;
				}
				cbMatches();
			});

		}, function (e) {
			cb();
		});

	}, function (e) {
		done(null, OgMap);
	});
};

function hash(string) {
	var hash = 0,
		i, chr;
	if (string.length === 0) return hash;
	for (i = 0; i < string.length; i++) {
		chr = string.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
}
