var async = require('async');
var fs = require('fs');
var RemoteRouting = require('loopback-remote-routing');
var path = require('path');

module.exports = function (Upload) {
	if (!process.env.ADMIN) {
		RemoteRouting(Upload, {
			'only': []
		});
	}
	// Remove dangling files from s3 before deleting instance
	Upload.observe('before delete', function (ctx, doneObserving) {
		var File = ctx.Model;
		Upload.find({
			where: ctx.where
		}, function (err, files) {

			// for all the Upload intances being deleted
			async.map(files, function (file, doneWithFiles) {

				// delete the files from s3
				async.map(file.imageSet, function (image, doneDeleting) {

					if (!process.env.LOCAL_UPLOADS) {

						Upload.app.models.Container.removeFile(file.bucket, image.key, function (err) {
							doneDeleting(err);
						});
					}
					else {
						var fname = image.path;
						if (image.url) {
							fname = image.url.replace(Upload.app.locals.config.publicHost, '');
							fname = path.resolve(__dirname, '../../client/' + fname);
						}
						fs.unlink(fname, function (err) {
							doneDeleting(err);
						});
					}

				}, function (err, obj) {
					doneWithFiles(err, obj);
				});

			}, function (err, obj) {
				doneObserving(err);
			});
		});
	});
};
