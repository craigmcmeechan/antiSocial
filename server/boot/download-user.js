var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var _ = require('lodash');
var archiver = require('archiver');
var unzipper = require('unzipper');
var path = require('path');
var fs = require('fs');
var mime = require('mime-types');
var uuid = require('uuid');
var async = require('async');
var base64 = require('base-64');
var request = require('request');
var JSONStream = require('JSONStream');

var VError = require('verror').VError;
var WError = require('verror').WError;

var TWO_HOURS = 60 * 60 * 2;

module.exports = function downloadUser(server) {
	var router = server.loopback.Router();

	/*
	// get a token to download data to a new server
	router.get('/transfer-token', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		currentUser.createAccessToken(TWO_HOURS, function (err, accessToken) {
			if (err) {
				var e = new VError(err, 'user.createAccessToken error');
				return next(e);
			}

			var token = {
				endpoint: req.app.locals.config.publicHost + '/' + currentUser.username,
				token: accessToken.id
			};

			res.render('pages/transfer-token', {
				'globalSettings': ctx.get('globalSettings'),
				user: currentUser,
				token: base64.encode(JSON.stringify(token))
			});
		});
	});
	*/

	// form to initiate account data transfer from another account/server
	router.get('/transfer', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		res.render('pages/transfer', {
			'globalSettings': ctx.get('globalSettings'),
			user: currentUser
		});
	});

	router.post('/transfer', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		var errors = '';

		// login and download data if we have credentials
		if (req.body['server'] && req.body['email'] && req.body['password']) {
			async.waterfall([
				function (cb) {
					var options = {
						'url': req.body['server'] + '/api/MyUsers/login',
						'form': {
							'email': req.body['email'],
							'password': req.body['password']
						},
						'json': true
					};
					request.post(options, function (err, response, body) {
						if (err) {
							return cb('an error occured ' + err);
						}
						if (response.statusCode !== 200) {
							if (response.statusCode === 404 || response.statusCode === 401) {
								return cb('login error');
							}
							else {
								return cb('an error occured ' + response.statusCode);
							}
						}
						var token = body.id;
						cb(null, token);
					});
				},
				function (token, cb) {
					var options = {
						'url': req.body['server'] + '/download.zip',
						'headers': {
							'access_token': token
						}
					};
					var theRequest = request(options)
						.on('error', function (err) {
							cb(err);
						})
						.on('response', function (response) {
							var extension = mime.extension(response.headers['content-type']);
							var filename = path.resolve(__dirname, '../../working/' + uuid() + '.' + extension);
							var fileStream = fs.createWriteStream(filename)
								.on('error', function (err) {
									cb(err);
								})
								.on('finish', function () {
									cb(null, token, filename);
								});
							theRequest.pipe(fileStream);
						});
				}
			], function (err, token, filename) {
				if (filename) {
					reanimate(server, currentUser, filename, function (err) {});
				}
				res.render('pages/transfer', {
					'globalSettings': ctx.get('globalSettings'),
					'user': currentUser,
					'errors': err,
					'importing': filename ? true : false,
				});
			});
		}
		else {
			errors = 'Missing Required Information';
			res.render('pages/transfer', {
				'globalSettings': ctx.get('globalSettings'),
				user: currentUser,
				errors: errors
			});
		}
	});

	// if the user is logged in make return a zip file of user data
	router.get('/download.zip', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		var zip = archiver('zip', {
			zlib: {
				level: 9
			}
		});

		var appDir = path.dirname(require.main.filename);
		var outfile = path.join(appDir, '../working/' + currentUser.username + '.zip');
		var output = fs.createWriteStream(outfile);

		zip.on('warning', function (err) {
			if (err.code === 'ENOENT') {
				console.log(err);
			}
			else {
				next(err);
			}
		});

		zip.on('error', function (err) {
			next(err);
		});

		zip.on('progress', function (progress) {
			console.log(progress);
		});

		output.on('close', function () {
			res.on('close', function (e) {
				fs.unlinkSync(outfile);
			});
			res.on('finish', function (e) {
				fs.unlinkSync(outfile);
			});
			res.sendFile(outfile, {
				'headers': {
					'Content-Type': 'application/zip',
					'Content-disposition': 'attachment; filename=' + currentUser.username + '.zip'
				}
			});
		});

		zip.pipe(output);

		async.series([
				function (cb) {
					req.app.models.MyUser.findById(currentUser.id, function (err, user) {
						zip.append(JSON.stringify([user], null, 2), {
							'name': 'MyUser.json'
						});
						cb(err);
					});
				},
				function (cb) {
					var query = {
						'where': {
							'userId': currentUser.id
						},
						'include': [
							'postPhotos'
						]
					};

					req.app.models.Post.find(query, function (err, posts) {
						zip.append(JSON.stringify(posts, null, 2), {
							'name': 'Post.json'
						});
						cb(err);
					});
				},
				function (cb) {
					var query = {
						'where': {
							userId: currentUser.id
						}
					};
					req.app.models.UserIdentity.find(query, function (err, identities) {
						zip.append(JSON.stringify(identities, null, 2), {
							'name': 'UserIdentity.json'
						});
						cb(err);
					});
				},
				function (cb) {
					var query = {
						'where': {
							userId: currentUser.id
						}
					};
					req.app.models.Friend.find(query, function (err, friends) {
						zip.append(JSON.stringify(friends, null, 2), {
							'name': 'Friend.json'
						});
						cb(err);
					});
				},
				function (cb) {
					var query = {
						'where': {
							userId: currentUser.id
						},
						'include': ['uploads']
					};
					req.app.models.Photo.find(query, function (err, photos) {
						zip.append(JSON.stringify(photos, null, 2), {
							'name': 'Photo.json'
						});

						var allImages = [];

						for (var j = 0; j < photos.length; j++) {
							for (var k = 0; k < photos[j].uploads().length; k++) {
								var uploads = photos[j].uploads()[k];
								allImages = allImages.concat(getImageSetUrls(uploads.imageSet));
							}
						}

						var imageMap = [];
						async.map(allImages, function (image, doneImage) {
							console.log(image);

							var mapped = {
								'old': image,
								'new': uuid()
							};

							var theRequest = request(image).on('response', function (response) {
								if (response.statusCode === 200) {
									if (response.headers['content-type']) {
										var extension = mime.extension(response.headers['content-type']);
										mapped.new += '.' + extension;
									}
									zip.append(theRequest, {
										name: 'images/' + mapped.new
									});
									imageMap.push(mapped);
								}
								doneImage();
							}).on('error', function (err) {
								console.log(err);
								doneImage();
							});
						}, function (err) {
							zip.append(JSON.stringify(imageMap, null, 2), {
								'name': 'imageMap.json'
							});
							cb(err);
						});
					});
				},
				function (cb) {
					var query = {
						'where': {
							userId: currentUser.id
						}
					};
					req.app.models.PushNewsFeedItem.find(query, function (err, pushItems) {
						zip.append(JSON.stringify(pushItems, null, 2), {
							'name': 'PushNewsFeedItem.json'
						});
						cb(err);
					});
				},
				function (cb) {
					var query = {
						'where': {
							'and': [{
								userId: currentUser.id
							}, {
								'originator': true
							}]
						}
					};
					req.app.models.NewsFeedItem.find(query, function (err, items) {
						zip.append(JSON.stringify(items, null, 2), {
							'name': 'NewsFeedItem.json'
						});
						cb(err);
					});
				},
				function (cb) {
					var query = {
						'where': {
							group: currentUser.username
						}
					};
					req.app.models.Settings.findOne(query, function (err, settings) {
						if (settings) {
							zip.append(JSON.stringify([settings], null, 2), {
								'name': 'Settings.json'
							});
						}
						cb(err);
					});
				}
			],
			function (err) {
				if (err) {
					zip.abort();
					fs.unlinkSync(outfile);
					return next(err);
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

function reanimate(app, currentUser, archive, done) {

	var reader = fs.createReadStream(archive);

	var appDir = path.dirname(require.main.filename);
	var extractTo = path.join(appDir, '../working/' + currentUser.username + '-unpacked');

	var parser = unzipper.Extract({
		'path': extractTo
	});

	parser.on('error', function (err) {
		console.log(err);
	});

	parser.on('finish', function (err) {
		if (err) {
			return done(err);
		}
		processArchive(app, currentUser, extractTo, function (err) {
			done(err);
		});
	});

	reader.pipe(parser);
}

function processArchive(app, currentUser, directory, done) {
	var newPhotos = {};
	var newImages = {};
	var newFriends = {};

	async.series([
			function importFriends(cb) {
				// import friends keeping track of new Id's
				var reader = fs.createReadStream(directory + '/Friend.json');
				var parser = JSONStream.parse('*');
				reader.on('error', function (err) {
					cb(err);
				});
				reader.on('end', function () {
					cb();
				});
				parser.on('data', function (data) {
					var oldId = data.id;
					delete data.id;
					data.userId = currentUser.id;
					currentUser.friends.create(data, function (err, friend) {
						newFriends[oldId] = friend.id;
						console.log('friends create', err, friend);
					});
				});
				reader.pipe(parser);
			},
			function importNewsFeedItems(cb) {
				// import NewsFeedItems and update friendId to new Id
				var reader = fs.createReadStream(directory + '/NewsFeedItem.json');
				var parser = JSONStream.parse('*');
				reader.on('error', function (err) {
					cb(err);
				});
				reader.on('end', function () {
					cb();
				});
				parser.on('data', function (data) {
					delete data.id;
					data.userId = currentUser.id;
					data.source = app.locals.config.publicHost + '/' + currentUser.username;
					data.friendId = newFriends[data.friendId];
					currentUser.newsFeeds.create(data, function (err, item) {
						console.log('newsFeeds create', err, item);
					});
				});
				reader.pipe(parser);
			},
			function importPushNewsFeedItems(cb) {
				// import PushNewsFeedItems
				var reader = fs.createReadStream(directory + '/NewsFeedItem.json');
				var parser = JSONStream.parse('*');
				reader.on('error', function (err) {
					cb(err);
				});
				reader.on('end', function () {
					cb();
				});
				parser.on('data', function (data) {
					delete data.id;
					data.userId = currentUser.id;
					currentUser.pushNewsFeedItems.create(data, function (err, item) {
						console.log('pushNewsFeedItems create', err, item);
					});
				});
				reader.pipe(parser);
			},
			function importIdentities(cb) {
				// Import Identities
				var reader = fs.createReadStream(directory + '/UserIdentity.json');
				var parser = JSONStream.parse('*');
				reader.on('error', function (err) {
					cb(err);
				});
				reader.on('end', function () {
					cb();
				});
				parser.on('data', function (data) {
					delete data.id;
					data.userId = currentUser.id;
					currentUser.identities.create(data, function (err, identity) {
						console.log('identity create', err, identity);
					});
				});
				reader.pipe(parser);
			},
			function importImages(cb) {
				// import images
				var reader = fs.createReadStream(directory + '/imageMap.json');
				var parser = JSONStream.parse('*');
				reader.on('error', function (err) {
					cb(err);
				});
				reader.on('end', function () {
					cb();
				});
				parser.on('data', function (data) {
					// copy image to new location
					// adjust data.new to point to new location (href)
					var newLocation = app.locals.config.publicHost + '/uploads/' + data.new;
					fs.rename(directory + '/images/' + data.new, 'client/uploads/' + data.new, function (err) {
						newImages[data.old] = newLocation;
					});
				});
				reader.pipe(parser);
			},
			function importPhotos(cb) {
				// Import photos and Uploads fixing related reference
				var reader = fs.createReadStream(directory + '/Photo.json');
				var parser = JSONStream.parse('*');
				reader.on('error', function (err) {
					cb(err);
				});
				reader.on('end', function () {
					cb();
				});
				parser.on('data', function (data) {
					var oldId = data.id;
					delete data.id;
					data.userId = currentUser.id;
					var uploads = data.uploads;
					delete data.uploads;
					currentUser.photos.create(data, function (err, photo) {
						console.log('photo create', err, photo);
						newPhotos[oldId] = photo.id;
						async.mapSeries(uploads, function (data, doneUpload) {
							delete data.id;
							data.uploadableId = photo.id;
							photo.uploads.create(data, function (err, upload) {
								console.log('upload create', err, upload);
								doneUpload();
							});
						}, function (err) {});
					});
				});
				reader.pipe(parser);
			},
			function importPosts(cb) {
				// Import posts and PostPhotos fixing related references
				var reader = fs.createReadStream(directory + '/Post.json');
				var parser = JSONStream.parse('*');
				reader.on('error', function (err) {
					cb(err);
				});
				reader.on('end', function () {
					cb();
				});
				parser.on('data', function (data) {
					delete data.id;
					data.userId = currentUser.id;
					data.source = app.locals.config.publicHost + '/' + currentUser.username;
					var postPhotos = data.postPhotos;
					delete data.postPhotos;
					currentUser.posts.create(data, function (err, post) {
						console.log('photo create', err, post);
						async.mapSeries(postPhotos, function (data, donePhoto) {
							delete data.id;
							data.postId = post.id;
							data.photoId = newPhotos[data.photoId];
							app.models.PostPhoto.create(data, function (err, upload) {
								console.log('upload create', err, upload);
								donePhoto();
							});
						}, function (err) {});
					});
				});
				reader.pipe(parser);
			},
			function importSettings(cb) {
				if (!fs.existsSync(directory + '/Settings.json')) {
					async.setImmediate(function () {
						return cb();
					});
				}
				var reader = fs.createReadStream(directory + '/Settings.json');
				var parser = JSONStream.parse('*');
				reader.on('error', function (err) {
					cb(err);
				});
				reader.on('end', function () {
					cb();
				});
				parser.on('data', function (data) {
					var q = {
						'where': {
							'group': currentUser.username
						}
					};
					app.models.Settings.findOrCreate(q, {
						'group': currentUser.username
					}, function (err, settings) {
						if (err) {
							return cb(err);
						}
						settings.settings = data.settings;
						settings.save();
						cb();
					});
				});
				reader.pipe(parser);
			},
			function importUser(cb) {
				// import user, does nothing at the moment
				var reader = fs.createReadStream(directory + '/MyUser.json');
				var parser = JSONStream.parse('*');
				reader.on('error', function (err) {
					cb(err);
				});
				reader.on('end', function () {
					cb();
				});
				parser.on('data', function (data) {});
				reader.pipe(parser);
			}
		],
		function (err) {
			done(err);
		}
	);
}
