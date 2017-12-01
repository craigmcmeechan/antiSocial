var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var _ = require('lodash');
var archiver = require('archiver');
var unzip = require('unzipper');
var path = require('path');
var fs = require('fs');
var multiparty = require('multiparty');
var mime = require('mime-types');
var uuid = require('uuid');
var async = require('async');

var VError = require('verror').VError;
var WError = require('verror').WError;

module.exports = function downloadUser(server) {
	var router = server.loopback.Router();

	router.get('/reanimate', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		res.render('pages/reanimate', {
			'globalSettings': ctx.get('globalSettings'),
		});
	});

	router.post('/reanimate', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		if (req.body.archive) {


			reanimate(currentUser, req.body.archive, function (err) {

			});
		}
		else {

			var form = new multiparty.Form();

			var foundUploadedFile = false;

			form.on('error', function (err) {
				next(new VError(err, 'error parsing upload'));
			});

			form.on('part', function (part) {

				foundUploadedFile = true;

				// build a write stream to save the file
				var filename = part.filename;
				var type = part.headers['content-type'];
				var extension = mime.extension(type);

				var localPath = 'client/import/' + uuid.v4();
				var localCopy = localPath + '.' + extension;

				var write = fs.createWriteStream(localCopy);

				write.on('error', function (err) {
					next(new VError(err, 'error saving upload %s', localCopy));
				});

				write.on('finish', function () {
					var parser = unzip.Extract({
						'path': localPath
					});
					parser.on('error', function (err) {
						console.log(err);
					});
					parser.on('close', function () {
						var contents = fs.readFileSync(localPath + '/backup.json');
						var toReAnimate = JSON.parse(contents);
						res.render('pages/reanimate-confirm', {
							'globalSettings': ctx.get('globalSettings'),
							'theUser': toReAnimate,
							'archive': localPath
						});
					})
					fs.createReadStream(localCopy).pipe(parser);
				});

				part.on('error', function (err) { // read stream error
					next(new VError(err, 'error reading upload part %s', part.filename));
				});

				// pipe the part into the file
				part.pipe(write);
			});

			form.on('close', function () {
				// if we end up here w/o finding the part named "uploadedFile" bail out
				if (!foundUploadedFile) {
					next(new VError('uploadedFile not found in multipart payload'));
				}
			});

			form.parse(req);
		}
	});

	router.get('/download.zip', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		req.app.models.MyUser.findById(currentUser.id, {
			'include': ['identities', {
				'posts': [{
					'comments': ['reactions']
				}, 'reactions', {
					'postPhotos': [{
						'photo': ['uploads']
					}]
				}]
			}, 'uploads', 'friends', 'settings', 'pushNewsFeedItems', 'newsFeeds', 'invitations']
		}, function (err, resolved) {
			var allImages = [];
			var posts = resolved.posts();
			for (var i = 0; i < posts.length; i++) {
				var post = posts[i];
				for (var j = 0; j < post.postPhotos().length; j++) {
					var postPhoto = post.postPhotos()[j];
					for (var k = 0; k < postPhoto.photo().uploads().length; k++) {
						var uploads = postPhoto.photo().uploads()[k];
						allImages = allImages.concat(getImageSetUrls(uploads.imageSet));
					}
				}
			}

			var userImages = resolved.uploads();
			for (var i = 0; i < userImages.length; i++) {
				var upload = userImages[i];
				allImages = allImages.concat(getImageSetUrls(upload.imageSet));
			}

			resolved.allImages = allImages;
			var zip = archiver('zip', {
				zlib: {
					level: 9
				}
			});

			var appDir = path.dirname(require.main.filename);
			var outfile = path.join(appDir, '../client/backup.zip');
			var output = fs.createWriteStream(outfile);

			zip.on('warning', function (err) {
				if (err.code === 'ENOENT') {
					// log warning
				}
				else {
					// throw error
					throw err;
				}
			});

			// good practice to catch this error explicitly
			zip.on('error', function (err) {
				throw err;
			});

			output.on('close', function () {
				res.on('close', function (e) {
					fs.unlinkSync(outfile)
				});
				res.on('finish', function (e) {
					fs.unlinkSync(outfile)
				});
				res.sendFile(outfile, {
					'headers': {
						'Content-Type': 'application/zip',
						'Content-disposition': 'attachment; filename=' + currentUser.username + '.zip'
					}
				});
			});

			zip.pipe(output);

			zip.append(JSON.stringify(resolved, null, 2), {
				'name': 'backup.json'
			});

			for (var i = 0; i < allImages.length; i++) {
				var file = path.join(appDir, '../client', allImages[i]);
				if (fs.existsSync(file)) {
					zip.file(file, {
						'name': 'images/' + allImages[i]
					});
				}
				else {
					console.log('missing:' + file);
				}
			}

			zip.finalize();
		});
	});

	server.use(router);
};

function getImageSetUrls(imageSet) {
	var result = [];
	for (var prop in imageSet) {
		if (imageSet.hasOwnProperty(prop)) {
			result.push(imageSet[prop].url);
		}
	}

	return result;
}

function reanimate(currentUser, archive, done) {
	var contents = fs.readFileSync(archive + '/backup.json');
	var toReAnimate = JSON.parse(contents);
	async.series([
		function importUser(cb) {
			currentUser.name = toReAnimate.name;
			currentUser.discoverable = toReAnimate.discoverable;
			//currentUser.username = toReAnimate.username;
			//currentUser.email = toReAnimate.email;
			currentUser.createdOn = toReAnimate.createdOn;
			currentUser.updatedOn = toReAnimate.updatedOn;
			currentUser.save(cb);
		},
		function importIdentities(cb) {
			async.map(toReAnimate.identities, function (item, cbMap) {
				delete item.id;
				currentUser.identities.create(item, cbMap);
			}, function (err) {
				return cb();
			});
		},
		function importUploads(cb) {
			async.map(toReAnimate.uploads, function (item, cbMap) {
				delete item.id;
				currentUser.uploads.create(item, cbMap);
			}, function (err) {
				return cb();
			});
		},
		function importFriends(cb) {
			async.map(toReAnimate.friends, function (item, cbMap) {
				delete item.id;
				currentUser.friends.create(item, cbMap);
			}, function (err) {
				return cb();
			});
		},
		function importSettings(cb) {
			async.map(toReAnimate.settings, function (item, cbMap) {
				delete item.id;
				currentUser.settings.create(item, cbMap);
			}, function (err) {
				return cb();
			});
		},
		function importPushNewsFeedItems(cb) {
			async.map(toReAnimate.pushNewsFeedItems, function (item, cbMap) {
				delete item.id;
				currentUser.pushNewsFeedItems.create(item, cbMap);
			}, function (err) {
				return cb();
			});
		},
		function importNewsFeeds(cb) {
			async.map(toReAnimate.newsFeeds, function (item, cbMap) {
				delete item.id;
				currentUser.newsFeeds.create(item, cbMap);
			}, function (err) {
				return cb();
			});
		},
		function importInvitations(cb) {
			async.map(toReAnimate.invitations, function (item, cbMap) {
				delete item.id;
				currentUser.invitations.create(item, cbMap);
			}, function (err) {
				return cb();
			});
		},
		function importPosts(cb) {
			async.map(toReAnimate.posts, function (item, cbMap) {
				delete item.id;
				currentUser.posts.create(item, function (err, post) {
					async.series([
						function importPostReactions(cbSeries) {
							async.map(item.reactions, function (reaction, cbInnerMap) {
								cbInnerMap();
							}, function (err) {
								cbSeries()
							})
						},
						function importPostComments(cbSeries) {
							async.map(item.comments, function (comment, cbInnerMap) {
								cbInnerMap();
							}, function (err) {
								cbSeries()
							})
						},
						function importPostPhotos(cbSeries) {
							async.map(item.posrPhotos, function (postPhoto, cbInnerMap) {
								cbInnerMap();
							}, function (err) {
								cbSeries()
							})
						}
					], function (err) {
						cbMap();
					});
				});
			}, function (err) {
				return cb();
			});
		}
	], function (err) {
		done(err);
	});
}
