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

  // create a new comment
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
            return next(e);
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
            var e = new VError(err, 'could not read photo');
            return cb(e);
          }
          if (!photo) {
            var e = new VError('photo not found');
            return cb(e);
          }

          photo.updateAttributes({
            'status': 'complete'
          }, function (err) {
            if (err) {
              var e = new VError(err, 'could not update photo status');
              return cb(e);
            }
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
          },
          'description': req.body.description
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
          'updatedOn': news.updatedOn,
          'description': news.description
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

  // edit a comment
  router.get('/comment/:id', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');
    var commentId = req.params.id;
    async.waterfall([
      function getComment(cb) {
        var query = {
          'where': {
            'and': [{
              'uuid': commentId
            }, {
              'userId': currentUser.id
            }]
          }
        };

        server.models.PushNewsFeedItem.findOne(query, function (err, comment) {
          if (err) {
            return cb(err);
          }

          if (!comment) {
            err = new Error('Comment not found');
            err.statusCode = 404;
            return cb(err);
          }

          cb(null, comment);
        });
      }
    ], function (err, comment) {
      res.render('components/comment-form', {
        'endpoint': '/comment/' + comment.uuid,
        'editing': true,
        'comment': comment
      });
    });
  });

  router.post('/comment/:id', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');
    var commentId = req.params.id;
    async.waterfall([
      function getComment(cb) {
        var query = {
          'where': {
            'and': [{
              'uuid': commentId
            }, {
              'userId': currentUser.id
            }]
          }
        };

        server.models.PushNewsFeedItem.findOne(query, function (err, comment) {
          if (err) {
            return cb(err);
          }

          if (!comment) {
            err = new Error('Comment not found');
            err.statusCode = 404;
            return cb(err);
          }

          cb(null, comment);
        });
      },
      function updateMyNewsFeed(comment, cb) {
        var query = {
          'where': {
            'and': [{
              'uuid': commentId
            }, {
              'userId': currentUser.id
            }]
          }
        };
        server.models.NewsFeedItem.findOne(query, function (err, item) {
          if (err || !item) {
            return cb(err, comment);
          }

          if (!item.versions) {
            item.versions = [];
          }
          item.versions.push({
            'body': comment.details.body,
            'timestamp': new Date(),
          });
          item.details.body = req.body.body;
          item.save(function (err) {
            cb(err, comment);
          });
        });
      }
    ], function (err, comment) {
      if (!comment.versions) {
        comment.versions = [];
      }
      comment.versions.push({
        'body': comment.details.body,
        'timestamp': new Date(),
      });
      comment.details.body = req.body.body;
      comment.save(function (err) {
        if (err) {
          return res.send({
            'result': {
              'status': err
            }
          });
        }
        res.send({
          'result': {
            'status': 'ok',
            'flashLevel': 'success',
            'flashMessage': 'saved'
          }
        });
      });
    });
  });

  router.delete('/comment/:id', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');
    var commentId = req.params.id;
    async.waterfall([
      function deletePushNews(cb) {
        server.models.PushNewsFeedItem.find({
          'where': {
            'and': [{
              'uuid': commentId
            }, {
              'userId': currentUser.id
            }]
          }
        }, function (err, items) {
          async.map(items, function (item, mapcb) {
            item.deleted = true;
            item.save();
            mapcb();
          }, function (err) {
            cb(err);
          });
        });
      },
      function deleteNewsFeedItems(cb) {
        server.models.NewsFeedItem.find({
          'where': {
            'and': [{
              'uuid': commentId
            }, {
              'userId': currentUser.id
            }]
          }
        }, function (err, items) {
          async.map(items, function (item, mapcb) {
            item.deleted = true;
            item.save();
            mapcb();
          }, function (err) {
            cb(err);
          });
        });
      }
    ], function (err) {
      if (err) {
        return res.send({
          'result': {
            'status': err
          }
        });
      }

      res.send({
        'result': {
          'status': 'ok',
          'flashLevel': 'success',
          'flashMessage': 'deleted'
        }
      });
    });
  });

  server.use(router);
};
