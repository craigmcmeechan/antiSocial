var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var url = require('url');
var uuid = require('uuid');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();

  // create a new post
  router.post('/comment', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');
    var myEndPoint = req.app.locals.config.publicHost + '/' + currentUser.username;
    var whoAbout = req.body.about.replace(/\/post\/.*$/, '');
    var postuuid = req.body.about.replace(/^.*\/post\//, '');
    var photoId = req.body.photoId;

    async.waterfall([
      function findFriend(cb) {
        var query = {
          'where': {
            'and': [{
              'userId': currentUser.id
            }, {
              'remoteEndPoint': whoAbout
            }]
          }
        };

        req.app.models.Friend.findOne(query, function (err, friend) {
          if (err) {
            var e = new VError(err, 'could not find friend');
            return next(err);
          }
          cb(null, friend);
        });
      },
      function attachPhoto(friend, cb) {
        if (!req.body.photos || !req.body.photos.length) {
          return cb(null, friend, null);
        }
        server.models.Photo.findById(req.body.photos[0].id, function (err, photo) {
          if (err) {
            return cb(err);
          }
          if (!photo) {
            return cb(err, friend, null);
          }

          photo.updateAttributes({
            'status': 'complete'
          }, function (err) {
            return cb(err, friend, photo);
          });
        });
      },
      function makePushNewsFeedItem(friend, photo, cb) { // notify network
        var item = {
          'uuid': uuid(),
          'type': 'comment',
          'source': server.locals.config.publicHost + '/' + currentUser.username,
          'about': req.body.about,
          'visibility': ['public'],
          'details': {
            'body': req.body.body,
            'photo': photo ? server.locals.config.publicHost + '/' + currentUser.username + '/photo/' + photo.uuid : ''
          }
        };

        currentUser.pushNewsFeedItems.create(item, function (err, pushNews) {
          if (err) {
            var e = new VError(err, 'could not save pushNewsFeedItems');
            return cb(e);
          }
          cb(err, friend, pushNews);
        });
      },
      function makeNewsFeedItem(friend, news, cb) { // notify self
        var item = {
          'uuid': news.uuid,
          'type': 'comment',
          'source': news.source,
          'about': news.about,
          'details': {
            'body': news.details.body,
            'photo': news.details.photo
          },
          'userId': currentUser.id,
          'createdOn': news.createdOn,
          'updatedOn': news.updatedOn
        };

        req.app.models.NewsFeedItem.create(item, function (err, item) {
          if (err) {
            var e = new VError(err, 'could not save NewsFeedItem');
            return cb(e);
          }

          cb(err, item);
        });
      }

    ], function (err, item) {
      if (err) {
        var e = new WError(err, 'could not save comment');
        return next(err);
      }

      res.send({
        'status': 'ok',
        'comment': item
      });

    });
  });
  server.use(router);
};
