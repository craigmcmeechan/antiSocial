req.app.models.Post.find({
	'where': {
		'userId': currentUser.id
	},
	'order': 'createdOn DESC',
	'limit': 30,
	'include': [{
		'user': ['uploads']
	}]
}, function (err, posts) {
	if (err) {
		return next(err);
	}

	resolveReactionsCommentsAndProfiles(posts, function (err) {
		resolvePostPhotos(posts, function (err) {
			for (var i = 0; i < posts.length; i++) {
				posts[i].counts = {};
				var reactions = posts[i].resolvedReactions;
				var counts = {};
				for (var j = 0; j < reactions.length; j++) {
					if (!posts[i].counts[reactions[j].reaction]) {
						posts[i].counts[reactions[j].reaction] = 0;
					}
					++posts[i].counts[reactions[j].reaction];
				}
			}
			res.render('pages/profile', {
				'profile': {
					'name': currentUser.name + ' (me)',
					'photo': server.locals.getUploadForProperty('photo', currentUser.uploads(), 'thumb', server.locals.headshotFPO),
					'background': server.locals.getUploadForProperty('background', currentUser.uploads(), 'large', server.locals.FPO),
					'endpoint': server.locals.config.publicHost + '/' + currentUser.username
				},
				'globalSettings': ctx.get('globalSettings'),
				'posts': posts,
				'user': currentUser,
				'isMe': true
			});
		});
	});
});
}
