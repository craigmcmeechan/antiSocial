var async = require('async');
var server = require('../server');
var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

function resolvePostPhotos(posts, done) {
	async.each(posts, function (post, cb) {
		debug('resolvePostPhotos ' + post.uuid);

		var query = {
			'where': {
				'postId': post.id
			},
			'include': [{
				'photo': ['uploads']
			}],
			'order': 'sequence ASC'
		};
		server.models.PostPhoto.find(query, function (err, postPhotos) {
			post.sortedPhotos = [];
			for (var i = 0; i < postPhotos.length; i++) {
				post.sortedPhotos.push(postPhotos[i].photo());
			}
			cb(null);
		});
	}, function (err) {
		done(null);
	});
}

module.exports = resolvePostPhotos;
