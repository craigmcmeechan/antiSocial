// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var loopback = require('loopback');
var server = require('../server');
var fs = require('fs');
var uuid = require('uuid');
var async = require('async');
var request = require('request');
var multiparty = require('multiparty');
var mime = require('mime-types');
var Uploader = require('s3-uploader');
var VError = require('verror').VError;
var WError = require('verror').WError;
var im = require('imagemagick');
var s3 = require('s3');
var resize = require('im-resize');
var _ = require('lodash');


module.exports = function () {

	var verbose = true;

	return function uploadableFactory(MyModel, myModelName, versionsByProperty) {

		// define polymorphic hasMany relationship from MyModel to Upload
		MyModel.hasMany(server.models.Upload, {
			as: 'uploads',
			'polymorphic': {
				foreignKey: 'uploadableId',
				discriminator: 'uploadableType'
			}
		});

		// MySQL: set type on the discriminatior property because default
		// in jugglingDB is varchar(512) which is too big to index
		server.models.Upload.dataSource.defineProperty('Upload', 'uploadableType', {
			type: 'string',
			length: 30,
			index: true
		});

		// cleanup the uploads before destroying a model instance
		MyModel.observe('before delete', function (ctx, doneObserving) {
			MyModel.find({
				where: ctx.where,
				include: ['uploads']
			}, function (err, users) {
				async.map(users, function (user, cb) {
					user.uploads.destroyAll(cb);
				}, function (err, obj) {
					doneObserving(err);
				});
			});
		});

		// upload a file and store metadata in an Upload instance for MyModel
		MyModel.upload = function (id, property, ctx, cb) {

			// process the upload
			MyModel.findById(ctx.args.id, function (err, instance) {
				if (err) {
					return cb(new VError(err, 'error reading %s.%s', myModelName, ctx.args.id));
				}
				if (!instance) {
					return cb(new VError(err, 'instance not found %s.%s', myModelName, ctx.args.id));
				}
				uploadable(myModelName, instance, property, ctx, versionsByProperty, function (err, upload) {
					return cb(err, upload);
				});
			});
		};

		// POST /api/MyModels/me/upload/:property
		// property is the use for the upload eg. 'photo' or 'background' etc.
		// requires:
		// 		req.body.url - url to copy file from
		// 		- or -
		// 		req.body.uploadedFile - multipart file upload payload
		MyModel.remoteMethod(
			'upload', {
				accepts: [{
					arg: 'id',
					type: 'string',
					required: true
				}, {
					arg: 'property',
					type: 'string',
					required: true
				}, {
					arg: 'ctx',
					type: 'object',
					http: {
						source: 'context'
					}
				}],
				http: {
					path: '/:id/upload/:property',
					verb: 'post'
				},
				returns: {
					arg: 'response',
					type: 'object'
				}
			}
		);
	};
};

// uploadable
// ----------
// upload handler used by models that have 'uploadables' relationship
// model: the 'from' model
// instance: the model instance
// property: the upload property eg: 'photo', 'background' etc.
// ctx: the context of the request
// versions: array specifying the resize specs for the upload fileSet

function uploadable(model, instance, property, ctx, versionsByProperty, next) {
	var req = ctx.req;
	var res = ctx.res;
	var params = req.query.id ? req.query : req.body;
	var ua = ctx.userAgent ? ctx.userAgent : _.get(ctx, 'req.headers["user-agent"]');

	var publicHost = server.locals.config.publicHost;

	var folder = model + '-' + property + '/';

	var versions = versionsByProperty[property] ? versionsByProperty[property] : [];

	// where uploads get saved
	var bucket = process.env.AWS_S3_BUCKET ? process.env.AWS_S3_BUCKET : 'site-uploads';
	var region = process.env.AWS_S3_REGION ? process.env.AWS_S3_REGION : 'us-standard';

	var AWS = require('aws-sdk');

	// configure AWS from ENV or file or EC2 metadata
	if (process.env.AWS_S3_KEY_ID && process.env.AWS_S3_KEY && process.env.AWS_S3_REGION) {
		AWS.config.update({
			'accessKeyId': process.env.AWS_S3_KEY_ID,
			'secretAccessKey': process.env.AWS_S3_KEY,
			'region': process.env.AWS_S3_REGION
		});
	}
	else if (process.env.AWS_CONFIG) {
		AWS.config.loadFromPath(process.env.AWS_CONFIG);
	}
	else {
		AWS.config.credentials = new AWS.EC2MetadataCredentials();
	}

	// get credentials from configured AWS so we can hand it to s3Uploader and s3 config
	var AWS_S3_KEY_ID = AWS.config.credentials.accessKeyId;
	var AWS_S3_KEY = AWS.config.credentials.secretAccessKey;

	// steps for processing the request
	async.waterfall([
		getLocalCopy,
		getInfo,
		uploadFile,
		cleanupOldUploadInstance,
		saveNewUploadInstance
	], function (err, results) {
		if (err) {
			var e;
			if (typeof (err) === 'string') {
				e = new WError('upload failed ', err);
			}
			else {
				e = new WError(err, 'upload failed', err);
			}
			console.log(e.toString());
			return next(e);
		}
		// success - back to caller
		next(null, results);
	});

	// getLocalCopy: aqcuire the file
	// if params.url get file from remote location
	// else if upload save file
	// callback with path to file
	function getLocalCopy(cb) {
		var localCopy;
		var meta = {};

		// doing a url upload
		if (params.url) {
			if (params.url.match(/^\/\//)) { // if url starts with '//'
				params.url = 'https:' + params.url;
			}
			meta.filename = params.url;
			try {
				var options = {
					url: params.url,
					'jar': request.jar(),
					'headers': {
						'user-agent': ua
					}
				};

				var theRequest = request
					.get(options)
					.on('error', function (err) {
						cb(new VError(err, 'error loading %s', params.url));
					})
					.on('response', function (response) {
						if (response.statusCode === 200) { //&& response.headers['content-type'] && response.headers['content-type'].match(/^image\//)) {

							// peek at the response to determine the content-type

							var extension;
							if (response.headers['content-type']) {
								meta.type = response.headers['content-type'];
								extension = mime.extension(meta.type);
							}
							else {
								extension = params.url.replace(/.*\.([a-z0-9A-Z]+)$/, '$1');
								if (extension === params.url) {
									extension = '';
								}
							}

							localCopy = 'client/uploads/' + uuid.v4();
							if (extension) {
								localCopy += '.' + extension;
							}

							// create a write stream to save the file
							var write = fs.createWriteStream(localCopy)
								.on('error', function (err) {
									cb(new VError(err, 'error saving %s', localCopy));
								})
								.on('finish', function () {
									// success - continue processing waterfall
									cb(null, localCopy, meta);
								});

							// pipe the request into the file
							theRequest.pipe(write);
						}
						else {
							var e = new Error('error downloading original copy');
							e.url = params.url;
							e.contentType = response ? response.headers['content-type'] : 'unknown';
							e.statusCode = response ? response.statusCode : 'unknown';
							console.log(e);
							cb(e);
						}
					});
			}
			catch (e) {
				cb(e);
			}
		}
		else if (params.localCopy) {
			cb(null, params.localCopy, meta);
		}
		else {

			// doing a multipart post upload

			var form = new multiparty.Form();

			var foundUploadedFileInUpload = false;

			form.on('error', function (err) {
				cb(new VError(err, 'error parsing upload'));
			});

			form.on('part', function (part) {
				if (part.name !== 'uploadedFile') {
					return part.resume();
				}

				foundUploadedFileInUpload = true;

				// build a write stream to save the file
				meta.filename = part.filename;
				meta.type = part.headers['content-type'];
				var extension = mime.extension(meta.type);

				localCopy = 'client/uploads/' + uuid.v4() + '.' + extension;

				var write = fs.createWriteStream(localCopy);

				write.on('error', function (err) {
					cb(new VError(err, 'error saving upload %s', localCopy));
				});

				write.on('finish', function () {
					// we have the file - continue processing waterfall
					cb(null, localCopy, meta);
				});

				part.on('error', function (err) { // read stream error
					cb(new VError(err, 'error reading upload part %s', part.filename));
				});

				// pipe the part into the file
				part.pipe(write);
			});

			form.on('close', function () {
				// if we end up here w/o finding the part named "uploadedFile" bail out
				if (!foundUploadedFileInUpload) {
					cb(new VError('uploadedFile not found in multipart payload'));
				}
			});

			form.parse(req);
		}
	}

	function getInfo(localCopy, meta, cb) {
		im.identify(['-strip', '-quiet', localCopy], function (err, features) {
			if (err) {
				cb(new VError(err, 'imagemagic identify failed'));
			}
			else {
				features = features.replace(/\n$/, '');
				var frames = features.split(/\n/);
				//console.log(frames);
				var attr = frames[0].split(/\s/);
				//console.log(attr);
				var dimensions = attr[2].split(/x/);
				meta.width = dimensions[0];
				meta.height = dimensions[1];
				meta.type = attr[1];
				if (frames.length > 1) {
					meta.isAnimatedGif = true;
					meta.type = 'image/gif';
				}
				cb(null, localCopy, meta);
			}
		});
	}

	// upload the original file to s3
	// and based on the spec in versions upload as many resized versions as needed
	function uploadFile(localCopy, meta, cb) {

		// if this is an animated gif don't resize - takes too long, just upload it
		if (meta.isAnimatedGif) {
			//console.log('animated');

			if (process.env.LOCAL_UPLOADS !== 'true') {

				var extension = mime.extension(meta.type);
				var key = folder + uuid.v4() + '-animated.' + extension;

				var images = [];
				images.push({
					original: true,
					width: meta.width,
					height: meta.height,
					key: key,
					url: 'https://s3.amazonaws.com/' + bucket + '/' + key
				});

				var client = s3.createClient({
					s3Options: {
						accessKeyId: AWS_S3_KEY_ID,
						secretAccessKey: AWS_S3_KEY,
					},
				});

				var params = {
					localFile: localCopy,
					ContentType: meta.type,
					s3Params: {
						Bucket: bucket,
						Key: key,
						ACL: 'public-read'
					},
				};

				var uploader = client.uploadFile(params);
				uploader.on('error', function (err) {
					console.error('unable to upload:', err.stack);
					cb(new VError(err, 's3 (animated) upload failed'));
				});
				uploader.on('end', function () {
					cb(null, instance, meta, images);
				});
			}
			else {
				var images = [];
				images.push({
					original: true,
					width: meta.width,
					height: meta.height,
					url: publicHost + localCopy.replace(/^client/, '')
				});
				cb(null, instance, meta, images);
			}
		}
		else {
			var options = {
				aws: {
					region: region,
					path: folder,
					acl: 'public-read',
					accessKeyId: AWS_S3_KEY_ID,
					secretAccessKey: AWS_S3_KEY,
					httpOptions: {
						timeout: 120000
					}
				},
				cleanup: {
					original: true,
					versions: true
				},
				original: {
					acl: 'public-read'
				},
				versions: versions,
				returnExif: true
			};

			// console.log(options);

			try {
				if (process.env.LOCAL_UPLOADS !== 'true') {
					var client = new Uploader(bucket, options);
					client.upload(localCopy, {}, function (err, images, uploadmeta) {
						if (err) {
							console.log(err);
							cb(new VError(err, 's3 uploader failed'));
						}
						else {
							// success - continue processing waterfall
							cb(null, instance, meta, images);
						}
					});
				}
				else {
					resize({
						'path': localCopy,
						'width': meta.width,
						'height': meta.height
					}, {
						'versions': JSON.parse(JSON.stringify(versions))
					}, {
						'quiet': true
					}, function (err, images) {
						if (err) {
							console.log(err);
							cb(new VError(err, 'im-resize failed'));
						}
						else {
							// success - continue processing waterfall
							images.push({
								original: true,
								width: meta.width,
								height: meta.height,
								path: localCopy
							});
							for (var i = 0; i < images.length; i++) {
								images[i].url = publicHost + images[i].path.replace(/^client/, '');
							}
							cb(null, instance, meta, images);
						}
					});
				}
			}
			catch (err) {
				cb(new VError(err, 's3 uploader failed'));
			}
		}
	}

	// cleanup old Upload instance before saving new one
	// Upload handles removing dangling files from s3
	function cleanupOldUploadInstance(instance, meta, images, cb) {

		// match any uploads to the instance for same property
		// also matched any '-cropped' versions of the upload
		var query = {
			and: [{
				or: [{
					'property': property
				}, {
					'property': property + '-cropped'
				}]
			}, {
				'uploadableId': instance.id
			}, {
				'uploadableType': model
			}]
		};

		server.models.Upload.destroyAll(query, function (err, info) {
			if (err) {
				return cb(new VError(err, 'Error deleting old version of uploadable'));
			}

			// success - continue processing waterfall
			cb(null, instance, meta, images);
		});
	}

	// create new Upload instance
	function saveNewUploadInstance(instance, meta, images, cb) {

		var original;
		for (var i = 0; i < images.length; i++) {
			if (images[i].original) {
				original = images[i];
			}
		}

		var fileInstance = instance.uploads.build({
			'property': property,
			'filename': meta.filename,
			'type': meta.type,
			'url': original.url,
			'imageSet': getResizedByType(images),
			'bucket': bucket,
			'key': original.key
		});

		fileInstance.save(function (err) {
			if (err) {
				return cb(new VError(err, 'Error saving Upload instance'));
			}

			// success - continue processing waterfall
			cb(null, fileInstance);
		});
	}
}

// reorganize the array we get back from s3-uploader into an object
// w/properties keyed on the "suffix" for each version defined in versions
//	{
//		'large': { url: 's3 url', other metadata },
//		'medium': { url: 's3 url', other metadata },
//		'thumb': { url: 's3 url', other metadata }
//	}
function getResizedByType(resized) {
	var types = {};
	for (var i = 0; i < resized.length; i++) {
		var type = resized[i].suffix ? resized[i].suffix : 'original';
		types[type] = resized[i];
	}
	return types;
}
