var async = require('async');

function getPhotosForPosts(posts, PostPhotosModel, done) {
	//console.log('getPhotosForPosts');
	async.each(posts, function (post, cb) {
		var query = {
			'where': {
				'postId': post.id
			},
			'include': [{
				'photo': ['uploads']
			}],
			'order': 'sequence ASC'
		};
		PostPhotosModel.find(query, function (err, postPhotos) {
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

module.exports = getPhotosForPosts;
