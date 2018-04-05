var cron = require('node-cron');
var async = require('async');
var debug = require('debug')('tasks');
var doPostNotifications = require('../lib/doPostNotifications');

module.exports = function autopost(server) {
	debug('starting autopost daemon');
	cron.schedule('*/1 * * * *', function () {
		debug('autopost task running');
		server.models.Post.find({
			'where': {
				'and': [{
					'posted': false
				}, {
					'autopost': {
						'lt': new Date()
					}
				}]
			},
			'include': [{
				'user': ['identities']
			}]
		}, function (err, posts) {
			async.map(posts, function (post, cb) {
				doAutopost(post, function (err, post) {
					cb(err);
				});
			}, function (err) {
				return;
			});
		});
	});
};

function doAutopost(post, done) {
	post.posted = true;
	post.save();
	doPostNotifications(post.user(), post, function (err, post) {
		done(err, post);
	});
}
