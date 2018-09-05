// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var ogs = require('open-graph-scraper');
var async = require('async');
var uploadable = require('../../server/lib/uploadable')();
var webshot = require('webshot');
var _ = require('lodash');
var VError = require('verror').VError;
var WError = require('verror').WError;
var tmp = require('tmp');
var request = require('request');
var path = require('path');
var urlParse = require('url');
var mime = require('mime-types');
var uuid = require('uuid');
var RemoteRouting = require('loopback-remote-routing');

module.exports = function (OgTag) {
	if (!process.env.ADMIN) {
		RemoteRouting(OgTag, {
			'only': ['@scrape', '@lookup', '@image']
		});
	}

	var verbose = process.env.VERBOSE;

	// add the uploadable behavior to the OgTag model
	// so we can store cached and resized images for the UI
	OgTag.on('attached', function () {
		var versions = {
			'image': [{
				suffix: 'large',
				quality: 90,
				maxHeight: 960,
				maxWidth: 960,
			}]
		};
		uploadable(OgTag, 'OgTag', versions);
	});

	// look in OgTag table for the url
	// If found we are done
	// If not found
	//   Retrieve the the HEAD for the url to determine if it still exists and the content-type
	//   Scrape OG tags from url
	//   If no image found in scraped OG tags, take a screenshot
	//   Save OgTag instance if needed
	//   Save resized image in s3 if needed

	OgTag.scrape = function (url, ctx, done) {

		var jar = request.jar();

		var refresh = _.get(ctx, 'req.query.refresh') ? true : false;

		if (verbose) {
			console.log('OgTag.scrape url:' + url + ' start refresh:' + refresh);
		}

		// we have several async tasks to perform so run it through waterfall
		async.waterfall([
			lookup,
			getContentType,
			getOgTags,
			save,
			screenshot,
			upload
		], function (err, instance) {
			if (err) {
				var e = new WError(err, 'OgTag scrape failed url:' + url);
				console.log(e.toString());
				return done(null, {});
			}

			done(err, instance);
		});

		// have we seen this page before?
		function lookup(cb) {
			if (verbose) {
				console.log('OgTag.scrape url:' + url + ' lookup');
			}

			OgTag.findOne({
				'where': {
					'url': url
				},
				'include': ['uploads']
			}, function (err, instance) {
				if (err) {
					return cb(new VError(err, 'error reading OGTag %s', url));
				}

				var og = {
					data: {}
				};

				if (instance && refresh) {
					instance.ogData = og;
					instance.success = undefined;
					instance.httpStatusCode = undefined;
				}

				cb(err, instance, instance ? instance.ogData : og);
			});
		}

		// determine the content-type of the url if not cached
		function getContentType(instance, og, cb) {
			if (instance && !refresh) {
				instance.ogData.cached = true;
				return cb(null, instance, og); // already have it
			}

			if (verbose) {
				console.log('OgTag.scrape url:' + url + ' getContentType');
			}

			var extension = path.extname(urlParse.parse(url).pathname);
			var contentType = mime.lookup(extension);

			if (contentType && (contentType.match(/^image\//) || contentType.match(/^video\//))) {
				og.success = true;
				og.data.contentType = contentType;
				og.data.ogImage = {
					'url': url
				};

				if (verbose) {
					console.log('OgTag.scrape url:' + url + ' getContentType using extension');
				}
				return cb(null, instance, og);
			}

			// need cookies for paywalled sites
			try {
				request({
						'method': 'GET',
						'url': url,
						'jar': jar,
						'headers': {
							//'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
						}
					},
					function (err, response, body) {
						if (verbose) {
							console.log('OgTag.scrape url:' + url + ' getContentType:', err, response ? response.statusCode : ' response empty');
						}

						if (!err && response.statusCode === 200) {
							og.success = response.statusCode === 200 ? true : false;
							og.httpStatusCode = response.statusCode;
							og.data.contentType = response.headers['content-type'];
							return cb(null, instance, og);
						}
						else {
							og.success = false;
							og.httpStatusCode = response ? response.statusCode : 404;
							og.httpError = err && err.message ? err.message : err;
							return cb(null, instance, og);
						}
					});
			}
			catch (err) {
				og.success = false;
				og.httpStatusCode = 404;
				og.httpError = err.message ? err.message : err;
				return cb(null, instance, og);
			}
		}

		// scrape the og tags from the url if needed
		function getOgTags(instance, og, cb) {

			if (instance && !refresh) {
				return cb(null, instance, og); // already have it
			}

			if (og && !og.success) {
				return cb(null, instance, og); // link is probably bad
			}

			if (verbose) {
				console.log('OgTag.scrape url:' + url + ' getOgTags');
			}

			var contentType = og.data.contentType;

			// if it's an image theres no need to scrape the og tags (they don't exist)
			if (contentType && (contentType.match(/^image\//) || contentType.match(/^video\//))) {
				og.data = {
					contentType: contentType,
					ogImage: {
						url: url
					}
				};

				return cb(null, instance, og);
			}

			// set up the call to open-graph-scraper
			// for paywalled sites like NYT we need to supply facebooks user agent string and support cookies
			var options = {
				'url': url,
				'headers': {
					//'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
				},
				'jar': jar,
				'onlyGetOpenGraphInfo': true,
				'timeout': 15000
			};

			// call open-graph-scraper
			try {
				ogs(options, function (err, og) {
					if (err) {
						console.log('scrape failed');
						og.success = false;
						return cb(null, instance, og);
					}
					og.data.contentType = contentType;
					cb(null, instance, og);
				});
			}
			catch (e) {
				return cb(null, instance, og);
			}
		}

		// save scraped og instance in cache if just scraped
		function save(instance, og, cb) {

			if (instance && !refresh) {
				return cb(null, instance, og); // already saved
			}

			if (instance) {
				if (verbose) {
					console.log('OgTag.scrape url:' + url + ' resave');
				}
				instance.ogData = og;
				instance.save(function (err, saved) {
					if (err) {
						return cb(new VError(err, 'could not save OgTag instance %j %j', url, og));
					}
					cb(null, saved, og);
				});
			}
			else {
				if (verbose) {
					console.log('OgTag.scrape url:' + url + ' save');
				}

				OgTag.create({
					url: url,
					ogData: og
				}, function (err, instance) {
					if (err) {
						return cb(new VError(err, 'could not save OgTag instance %j %j', url, og));
					}
					cb(null, instance, og);
				});
			}
		};

		// fall back to a screenshot if no image in og tags
		function screenshot(instance, og, cb) {
			if (refresh) {
				if (_.get(og, 'data.ogImage')) {
					return cb(null, instance, og, null); // don't need screenshot
				}
			}
			else {
				if ((instance && instance.uploads && instance.uploads() && instance.uploads().length) || _.get(og, 'data.ogImage')) { // cached, don't need to do anything
					return cb(null, instance, og, null); // don't need screenshot
				}
			}

			if (og && !og.success) {
				return cb(null, instance, og, null); // link is probably bad
			}

			if (verbose) {
				console.log('OgTag.scrape url:' + url + ' screenshot');
			}

			var name = 'client/uploads/' + uuid.v4() + '.jpg';
			webshot(url, name, function (err) {
				if (err) {
					return cb(err);
				}
				cb(null, instance, og, name);
			});
		}

		// upload resized screenshot or data.ogImage to s3
		function upload(instance, og, screenshot, cb) {

			if (og && !og.success) {
				return cb(null, instance); // link is probably bad
			}

			if (!refresh) {
				if ((instance && instance.uploads && instance.uploads() && instance.uploads().length) || (!screenshot && !_.get(og, 'data.ogImage.url'))) {
					return cb(null, instance); // don't need to save image
				}
			}

			if (verbose) {
				console.log('OgTag.scrape url:' + url + ' upload');
			}

			// normally this is called via the api /api/modelname/id/upload
			// but we can also call programatically by setting up the input in ctx
			// if screenshot 'localCopy' will be set otherwise we use the url of the ogImage
			var myCtx = {
				args: {
					id: instance.id
				},
				req: {
					query: {
						'id': instance.id,
						'localCopy': screenshot,
						'url': _.has(og, 'data.ogImage.url') ? og.data.ogImage.url : null
					}
				}
			};

			try {
				OgTag.upload(instance.id, 'image', myCtx, function (err, upload) {
					if (err) {
						if (verbose) {
							console.log('OgTag.scrape url:' + url + ' upload failed ', _.get(err, 'jse_cause.contentType'), _.get(err, 'jse_cause.statusCode'));
						}
						instance.ogData.ogImage.success = false;
						instance.ogData.ogImage.httpStatusCode = _.get(err, 'jse_cause.statusCode');
						instance.save(function (err, saved) {
							return cb(err, saved);
						});
					}
					else {
						// include the upload instance on the ogTag instance
						OgTag.include([instance], 'uploads', function (err, instances) {
							if (err) {
								return cb(new VError(err, 'could not include uploads'));
							}
							cb(null, instances[0]);
						});
					}
				});
			}
			catch (e) {
				return cb(new VError(e, 'upload failed'));
			}
		}

	};

	// look in OgTag table for url.
	OgTag.lookup = function (url, ctx, done) {
		async.waterfall([
				// have we seen this page before?
				function lookup(cb) {

					OgTag.findOne({
						'where': {
							'url': url
						},
						'include': ['uploads']
					}, function (err, instance) {
						if (err) {
							return cb(new VError(err, 'error reading %s.%s', MyModelName, url));
						}
						cb(err, instance, instance ? instance.data : {});
					});
				}
			],
			// done processing
			function (err, instance) {
				if (err) {
					var e = new WError(err, 'OgTag lookup failed');
					console.log(e.toString());
					return done(e);
				}
				done(err, instance);
			});
	};

	OgTag.image = function (url, ctx, done) {
		async.waterfall([
				function lookup(cb) {

					OgTag.findOne({
						'where': {
							'url': url
						},
						'include': ['uploads']
					}, function (err, instance) {
						if (err) {
							return cb(new VError(err, 'error reading %s.%s', MyModelName, url));
						}
						var image = '/images/fpo.jpg';

						if (instance && instance.uploads()) {
							image = instance.uploads()[0].imageSet.large.url;
						}

						cb(err, image);
					});
				}
			],
			// done processing
			function (err, instance) {
				if (err) {
					var e = new WError(err, 'OgTag lookup failed');
					console.log(e.toString());
					return done(e);
				}
				done(err, instance);
			});
	};

	OgTag.remoteMethod(
		'scrape', {
			http: {
				path: '/scrape',
				verb: 'get'
			},
			accepts: [{
				arg: 'url',
				type: 'string',
				required: true,
				http: {
					source: 'query'
				}
			}, {
				arg: 'ctx',
				type: 'object',
				http: {
					source: 'context'
				}
			}],
			returns: {
				arg: 'result',
				type: 'object'
			}
		}
	);

	OgTag.remoteMethod(
		'image', {
			http: {
				path: '/image',
				verb: 'get'
			},
			accepts: [{
				arg: 'url',
				type: 'string',
				required: true,
				http: {
					source: 'query'
				}
			}, {
				arg: 'ctx',
				type: 'object',
				http: {
					source: 'context'
				}
			}],
			returns: {
				type: 'string',
				root: true
			}
		}
	);

	OgTag.remoteMethod(
		'lookup', {
			http: {
				path: '/lookup',
				verb: 'get'
			},
			accepts: [{
				arg: 'url',
				type: 'string',
				required: true,
				http: {
					source: 'query'
				}
			}, {
				arg: 'ctx',
				type: 'object',
				http: {
					source: 'context'
				}
			}],
			returns: {
				arg: 'result',
				type: 'object'
			}
		}
	);
};
