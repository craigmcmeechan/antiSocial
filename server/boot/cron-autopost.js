// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var cron = require('node-cron');
var async = require('async');
var debug = require('debug')('tasks');
var doPostNotifications = require('../lib/doPostNotifications');

module.exports = function autopost(server) {
	if (process.env.NODE_ENV !== 'production') {
		return;
	}
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
