var getCurrentUser = require('../middleware/context-currentUser');

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/communities', getCurrentUser(), function (req, res) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		server.models.MyUser.find({
			'where': {
				'community': true
			},
			'include': ['uploads']
		}, function (err, communities) {

			var myCommunities = [];
			if (currentUser) {
				for (var i = 0; i < currentUser.friends().length; i++) {
					var friend = currentUser.friends()[i];
					if (friend.community) {
						myCommunities.push(friend);
					}
				}
			}


			res.render('pages/communities', {
				'user': currentUser,
				'globalSettings': ctx.get('globalSettings'),
				'pageTitle': 'Communities',
				'communities': communities,
				'myCommunities': myCommunities
			});
		});
	});

	server.use(router);
};
