var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var isInitialized = require('../middleware/context-initialized');
var publicUsers = require('../middleware/context-publicUsers');
var pendingFriendRequests = require('../middleware/context-pendingFriendRequests');
var getRecentPosts = require('../middleware/context-getRecentPosts');
var getFriends = require('../middleware/context-getFriends');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var getFriendForEndpoint = require('../middleware/context-getFriendForEndpoint');
var resolveProfiles = require('../lib/resolveProfiles');
var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var nodemailer = require('nodemailer');
var qs = require('querystring');
var encryption = require('../lib/encryption');

var uuid = require('uuid');

var url = require('url');
var uuid = require('uuid');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var request = require('request');
var _ = require('lodash');
var multer = require('multer');
var path = require('path');
var pug = require('pug');

var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();

  // create a new post
  router.post('/post', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');
    req.body.uuid = uuid();
    req.body.source = server.locals.config.publicHost + '/' + currentUser.username;

    // if about is same as source delete about
    if (req.body.about === req.body.source) {
      delete req.body.about;
    }

    async.waterfall([
      function (cb) { // create the post
        currentUser.posts.create(req.body, function (err, post) {
          if (err) {
            var e = new VError(err, 'could create Post');
            return cb(e);
          }

          cb(null, post);
        });
      },
      function (post, cb) { // associate uploaded pending photos through PostPhoto
        if (!req.body.photos) {
          return cb(null, post, null);
        }
        var count = 0;
        async.mapSeries(req.body.photos, function (photo, mapCallback) {
          req.app.models.PostPhoto.create({
            'photoId': photo.id,
            'postId': post.id,
            'sequence': count++,
            'title': photo.title,
            'description': photo.description
          }, function (err, photoInstance) {
            if (err) {
              var e = new VError(err, 'could create PostPhoto');
              return mapCallback(e);
            }
            mapCallback(null, photoInstance);
          });
        }, function (err, postPhotoInstances) {
          if (err) {
            var e = new VError(err, 'error creating PostPhotos');
            return cb(e, post);
          }
          cb(null, post, postPhotoInstances);
        });
      },
      function (post, postPhotoInstances, cb) { // update the photos
        if (!req.body.photos) {
          return cb(null, post, null);
        }
        // get photos for PostPhotos
        req.app.models.PostPhoto.include(postPhotoInstances, 'photo', function (err) {
          if (err) {
            var e = new VError(err, 'error including photos in PostPhotos');
            return cb(e, post, postPhotoInstances);
          }

          // update the photo status from pending to complete
          async.eachSeries(postPhotoInstances, function (postPhoto, eachCb) {
            postPhoto.photo().updateAttributes({
              'status': 'complete',
              'title': postPhoto.title,
              'description': postPhoto.description
            }, function (err) {
              if (err) {
                var e = new VError(err, 'error marking status of Photo');
                return eachCb(e);
              }
              eachCb();
            });
          }, function (err) {
            if (err) {
              var e = new VError(err, 'error marking status of Photos');
              return cb(e, post, postPhotoInstances);
            }
            cb(null, post, postPhotoInstances);
          });
        });
      },
      function (post, postPhotoInstances, cb) { // tell the world
        currentUser.pushNewsFeedItems.create({
          'uuid': uuid(),
          'type': 'post',
          'source': server.locals.config.publicHost + '/' + currentUser.username,
          'about': server.locals.config.publicHost + '/' + currentUser.username + '/post/' + post.uuid,
          'target': post.about,
          'visibility': post.visibility,
          'details': {}
        }, function (err, news) {
          if (err) {
            var e = new VError(err, 'could push news feed');
            return cb(e);
          }
          cb(null, news, post);
        });
      },
      function notifyTagged(news, post, cb) { // notify tagged
        var re = /\(tag\:([^\)]+)\)/g;
        var tags = post.body.match(re);
        async.map(tags, function (tag, doneTag) {
          var friendEndPoint = tag;
          friendEndPoint = friendEndPoint.replace(/^\(tag\:/, '');
          friendEndPoint = friendEndPoint.replace(/\)$/, '');
          server.models.Friend.findOne({
            'where': {
              'remoteEndPoint': friendEndPoint
            }
          }, function (err, friend) {
            currentUser.pushNewsFeedItems.create({
              'uuid': uuid(),
              'type': 'tag',
              'source': server.locals.config.publicHost + '/' + currentUser.username,
              'about': server.locals.config.publicHost + '/' + currentUser.username + '/post/' + post.uuid,
              'target': friend.remoteEndPoint,
              'visibility': post.visibility,
              'details': {}
            }, function (err, news) {
              if (err) {
                var e = new VError(err, 'could push news feed');
                return doneTag(e);
              }
              doneTag(null);
            });
          });
        }, function (err) {
          cb(null, news, post);
        });
      },
      function makeNewsFeedItem(news, post, cb) { // notify self
        var item = {
          'uuid': news.uuid,
          'type': 'post',
          'source': news.source,
          'about': news.about,
          'target': post.about,
          'userId': currentUser.id,
          'createdOn': news.createdOn,
          'updatedOn': news.updatedOn,
          'originator': true,
          'details': {}
        };

        req.app.models.NewsFeedItem.create(item, function (err, item) {
          if (err) {
            var e = new VError(err, 'could not save NewsFeedItem');
            return cb(e);
          }

          cb(err, post);
        });
      }
    ], function (err, post) {
      if (err) {
        var e = new WError(err, 'could not save post');
        server.locals.logger.error(e.toString());
        return res.send({
          'status': 'could not save post'
        });
      }
      res.send({
        'status': 'ok',
        'uuid': post.uuid,
        'post': post
      });
    });
  });

  server.use(router);
};
