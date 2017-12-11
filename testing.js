router.get(postRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
	var ctx = req.myContext;
	var matches = req.url.match(postRE);
	var username = matches[1];
	var postId = matches[2];
	var view = matches[3];
	var friend = ctx.get('friendAccess');
	var currentUser = ctx.get('currentUser');

	req.app.models.MyUser.findOne({
		'where': {
			'username': username
		},
		'include': ['uploads']
	}, function (err, user) {

		if (err || !user) {
			return res.sendStatus('404');
		}

		async.waterfall([
			function (cb) {
				getUser(username, function (err, user) {
					cb(err, user);
				});
			},
			function (user, cb) {
				if (!user) {
					return process.nextTick(function () {
						cb();
					});
				}
				getPost(postId, user, friend, function (err, post) {
					cb(err, user, post);
				});
			},
			function (user, post, cb) {
				if (!post) {
					return process.nextTick(function () {
						cb();
					});
				}
				resolveReactions([post], function (err) {
					cb(err, user, post);
				});
			},
			function (user, post, cb) {
				if (!post) {
					return process.nextTick(function () {
						cb();
					});
				}
				resolveRComments([post], function (err) {
					cb(err, user, post);
				});
			},
			function (user, post, cb) {
				if (!post) {
					return process.nextTick(function () {
						cb();
					});
				}
				resolvePostPhotos([post], function (err) {
					cb(err, user, post);
				});
			}
		], function (err, user, post) {
			var data = {
				'post': post
			};

			if (view === '.json') {
				return res.send(encryptIfFriend(friend, data));
			}

			pug.renderFile(server.get('views') + '/components/rendered-post.pug', {
				'data': data,
				'user': currentUser,
				'friend': friend,
				'moment': server.locals.moment,
				'marked': server.locals.marked
			}, function (err, html) {
				if (err) {
					console.log(err);
					return res.sendStatus(500);
				}
				return res.send(encryptIfFriend(friend, html));
			});
		});
	});
});
