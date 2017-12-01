var async = require('async');
var resolveProfiles = require('../lib/resolveProfiles');

function resolveProfilesForPost(post, done) {
	//console.log('post',post.id,post.comments(),post.reactions());
	async.series([
		function (cb) {
			async.each([post], resolveProfiles, function (err) {
				cb(err);
			});
		},
		function (cb) {
			var comments = typeof post.comments === 'function' ? post.comments() : post.comments;
			async.each(comments, resolveProfiles, function (err) {
				cb(err);
			});
		},
		function (cb) {
			var reactions = typeof post.reactions === 'function' ? post.reactions() : post.reactions;

			async.each(reactions, resolveProfiles, function (err) {
				cb(err);
			});
		}
	], function (err) {
		done(err);
	});
}

function resolveProfilesForPosts(posts, done) {
	async.each(posts, resolveProfilesForPost, function (err) {
		done(err);
	});
}

module.exports = resolveProfilesForPosts;
