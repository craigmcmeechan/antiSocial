var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var mime = require('mime');
var uuid = require('uuid');
var multer = require('multer');

var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

module.exports = function (server) {
	var router = server.loopback.Router();

	var storage = multer.diskStorage({
		destination: function (req, file, cb) {
			cb(null, 'client/uploads/')
		},
		filename: function (req, file, cb) {
			cb(null, uuid() + '.' + mime.extension(file.mimetype));
		}
	})

	var upload = multer({
		'storage': storage
	});

	router.post('/pending-upload', getCurrentUser(), ensureLoggedIn(), upload.single('file'), function (req, res, next) {

		//console.log(req.file);

		if (!req.file.mimetype.match(/^image\//)) {
			return res.status(422).send({
				error: 'The uploaded file must be an image'
			});
		}

		res.app.models.Photo.create({
			userId: req.myContext.get('currentUser').id,
			status: 'pending',
			uuid: uuid()
		}, function (err, photo) {

			var myCtx = {
				args: {
					id: photo.id
				},
				req: {
					query: {
						'id': photo.id,
						'localCopy': req.file.path
					}
				}
			};

			res.app.models.Photo.upload(photo.id, 'optimized', myCtx, function (uploaderr, upload) {
				if (uploaderr) {
					var e = new WError(uploaderr, 'could not upload');
					req.logger.error(e.toString());

					photo.destroy(function (err) {
						return next(e);
					});
				}
				else {
					res.app.models.Photo.include([photo], 'uploads', function (err, instances) {
						if (err) {
							var e = new WError(err, 'could not include uploads')
							req.logger.error(e.toString());
							return next(e);
						}
						res.send(instances[0]);
					});
				}
			});
		});
	});

	server.use(router);
};
