var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var isInitialized = require('../middleware/context-initialized');
var publicUsers = require('../middleware/context-publicUsers');
var resolveProfiles = require('../lib/resolveProfiles');
var resolvePostPhotos = require('../lib/resolvePostPhotos');
var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var encryption = require('../lib/encryption');
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
var FB = require('fb');


var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();

  // edit a post
  router.get('/post/:id', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');
    var postId = req.params.id;
    async.waterfall([
      function getPost(cb) {
        var query = {
          'where': {
            'and': [{
              'uuid': postId
            }, {
              'userId': currentUser.id
            }]
          }
        };

        server.models.Post.findOne(query, function (err, post) {
          if (err) {
            return cb(err);
          }

          if (!post) {
            err = new Error('Post not found');
            err.statusCode = 404;
            return cb(err);
          }

          cb(null, post);
        });
      }
    ], function (err, post) {
      res.render('components/posting-form', {
        'editing': true,
        'post': post
      });
    });
  });

  router.post('/post/:id', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');
    var postId = req.params.id;
    async.waterfall([
      function getPost(cb) {
        var query = {
          'where': {
            'and': [{
              'uuid': postId
            }, {
              'userId': currentUser.id
            }]
          }
        };

        server.models.Post.findOne(query, function (err, post) {
          if (err) {
            return cb(err);
          }

          if (!post) {
            err = new Error('Post not found');
            err.statusCode = 404;
            return cb(err);
          }

          cb(null, post);
        });
      },
      function updatePost(post, cb) {

        if (!post.versions) {
          post.versions = [];
        }
        post.versions.push({
          'body': post.body,
          'visibility': post.visibility,
          'timestamp': new Date(),
          'geoDescription': post.geoDescription,
          'geoLocation': post.geoLocation,
          'tags': post.tags
        });
        post.body = req.body.body;
        post.visibility = req.body.visibility;
        post.geoDescription = req.body.geoDescription;
        post.geoLocation = req.body.geoLocation;
        post.save(function (err) {
          if (err) {
            cb(err);
          }
          cb(null, post);
        });
      },
      function notifyTagged(post, cb) { // notify tagged
        post.tags = [];
        var re = /\(tag-hash-([^)]+)\)/g;
        var tags = post.body.match(re);
        if (tags) {
          for (var i = 0; i < tags.length; i++) {
            var tag = tags[i];
            tag = tag.replace(/^\(tag-hash-/, '');
            tag = tag.replace(/\)$/, '');
            post.tags.push('#' + tag);
          }
        }

        re = /\(tag-user-([^)]+)\)/g;
        tags = post.body.match(re);
        async.map(tags, function (tag, doneTag) {
          var friendEndPoint = tag;
          friendEndPoint = friendEndPoint.replace(/^\(tag-user-/, '');
          friendEndPoint = friendEndPoint.replace(/\)$/, '');
          post.tags.push('@' + friendEndPoint);
          doneTag();
          /*
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
              'details': {},
              'tags': post.tags
            }, function (err, news) {
              if (err) {
                var e = new VError(err, 'could push news feed');
                return doneTag(e);
              }
              doneTag(null);
            });
          });
          */
        }, function (err) {
          if (post.tags.length) {
            post.save();
          }
          cb(null, post);
        });
      },
      function updatePushNewsFeedItem(post, cb) {
        req.app.models.PushNewsFeedItem.findOne({
          'where': {
            'type': 'post',
            'about': post.source + '/post/' + post.uuid,
            'userId': currentUser.id
          }
        }, function (err, news) {
          if (err) {
            var e = new VError(err, 'could not update PushNewsFeedItem');
            return cb(e);
          }
          news.tags = post.tags;
          news.save();
          cb(null, post);
        });
      },
      function makeNewsFeedItem(post, cb) { // notify self
        req.app.models.NewsFeedItem.findOne({
          'where': {
            'type': 'post',
            'about': post.source + '/post/' + post.uuid,
            'userId': currentUser.id
          }
        }, function (err, news) {
          if (err) {
            var e = new VError(err, 'could not update NewsFeedItem');
            return cb(e);
          }
          news.tags = post.tags;
          news.save();
          cb(null, post);
        });
      }
    ], function (err, post) {
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

  // delete a post
  // TODO improve error handling
  router.delete('/post/:id', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');
    var postId = req.params.id;
    async.waterfall([
        function getPost(cb) {
          var query = {
            'where': {
              'and': [{
                'uuid': postId
              }, {
                'userId': currentUser.id
              }]
            }
          };

          server.models.Post.findOne(query, function (err, post) {
            if (err) {
              return cb(err);
            }

            if (!post) {
              err = new Error('Post not found');
              err.statusCode = 404;
              return cb(err);
            }

            cb(null, post);
          });
        },
        function deletePhotos(post, cb) {
          server.models.PostPhoto.destroyAll({
            'postId': post.id
          }, function (err, data) {
            console.log('deletePhotos', err, data);
            cb(err, post);
          });
        },
        function markPushNewsDeleted(post, cb) {
          var q = {
            'where': {
              'and': [{
                'about': {
                  'like': new RegExp('^' + post.source + '/post/' + post.uuid)
                }
              }, {
                'userId': currentUser.id
              }]
            }
          };

          server.models.PushNewsFeedItem.find(q, function (err, items) {
            for (var i = 0; i < items.length; i++) {
              items[i].updateAttribute('deleted', true);
            }
            cb(err, post);
          });
        },
        function deleteNewsFeedItems(post, cb) {
          server.models.NewsFeedItem.destroyAll({
            'and': [{
              'userId': currentUser.id
            }, {
              'about': {
                'like': new RegExp('^' + post.source + '/post/' + post.uuid)
              }
            }]
          }, function (err, data) {
            console.log('deleteNewsFeedItems', err, data);
            cb(err, post);
          });
        },
        function deletePost(post, cb) {
          post.destroy(function (err) {
            cb(err);
          });
        }
      ],
      function (err) {
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

    var fbIdentity;
    var twIdentity;
    if (currentUser.identities()) {
      for (var i = 0; i < currentUser.identities().length; i++) {
        var identity = currentUser.identities()[i];
        if (identity.provider === 'facebook') {
          fbIdentity = identity;
        }
        if (identity.provider === 'twitter') {
          twIdentity = identity;
        }
      }
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
          return cb(null, post);
        }
        // get photos for PostPhotos
        req.app.models.PostPhoto.include(postPhotoInstances, 'photo', function (err) {
          if (err) {
            var e = new VError(err, 'error including photos in PostPhotos');
            return cb(e, post);
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
              return cb(e, post);
            }
            cb(null, post);
          });
        });
      },
      function notifyTagged(post, cb) { // notify tagged
        post.tags = [];
        var re = /\(tag-hash-([^)]+)\)/g;
        var tags = post.body.match(re);
        if (tags) {
          for (var i = 0; i < tags.length; i++) {
            var tag = tags[i];
            tag = tag.replace(/^\(tag-hash-/, '');
            tag = tag.replace(/\)$/, '');
            post.tags.push('#' + tag);
          }
        }

        re = /\(tag-user-([^)]+)\)/g;
        tags = post.body.match(re);
        async.map(tags, function (tag, doneTag) {
          var friendEndPoint = tag;
          friendEndPoint = friendEndPoint.replace(/^\(tag-user-/, '');
          friendEndPoint = friendEndPoint.replace(/\)$/, '');
          post.tags.push('@' + friendEndPoint);
          doneTag();
          /*
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
              'details': {},
              'tags': post.tags
            }, function (err, news) {
              if (err) {
                var e = new VError(err, 'could push news feed');
                return doneTag(e);
              }
              doneTag(null);
            });
          });
          */
        }, function (err) {
          if (post.tags.length) {
            post.save();
          }
          cb(null, post);
        });
      },
      function (post, cb) { // tell the world
        currentUser.pushNewsFeedItems.create({
          'uuid': uuid(),
          'type': 'post',
          'source': server.locals.config.publicHost + '/' + currentUser.username,
          'about': server.locals.config.publicHost + '/' + currentUser.username + '/post/' + post.uuid,
          'target': post.about,
          'visibility': post.visibility,
          'details': {},
          'tags': post.tags
        }, function (err, news) {
          if (err) {
            var e = new VError(err, 'could push news feed');
            return cb(e);
          }
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
          'details': {},
          'tags': post.tags
        };

        req.app.models.NewsFeedItem.create(item, function (err, item) {
          if (err) {
            var e = new VError(err, 'could not save NewsFeedItem');
            return cb(e);
          }

          cb(err, post);
        });
      },
      function crossPostFacebook(post, cb) {
        if (!fbIdentity || post.visibility.indexOf('facebook') === -1) {
          return cb(null, post);
        }

        resolvePostPhotos([post], function (err) {

          var fb = new FB.Facebook({
            'appId': process.env.FACEBOOK_CLIENT_ID,
            'appSecret': process.env.FACEBOOK_CLIENT_SECRET,
            'accessToken': fbIdentity.credentials.token
          });

          var body = '';
          var links = [];

          if (post.visibility.indexOf('public') !== -1) {
            // pass the permilink of the post to facebook and let it build the preview
            links = [server.locals.config.publicHost + '/' + currentUser.username + '/post/' + post.uuid];
          }
          else {
            // try to adapt the post to facebook limitations
            body = post.body;

            // extract first link
            links = post.body.match(/^(http[^\s\b]*)/gm);
            if (links) {
              body = body.replace(/^(http[^\s\b]*)/gm, '');
            }

            // strip all other markup
            body = server.locals.marked(body);
            body = body.replace(/<[^>]+>/g, '');

            // if there are photos... attach the first one
            if (post.sortedPhotos && post.sortedPhotos.length) {
              var imageSet = post.sortedPhotos[0].uploads()[0].imageSet;
              var image;
              if (imageSet.large) {
                image = imageSet.large.url;
              }
              else {
                image = imageSet.original.url;
              }
              links = [image];
            }
          }

          fb.api(
            '/me/feed',
            'POST', {
              'message': body,
              'link': links.length ? links[0] : null
            },
            function (response) {
              if (response && response.error) {
                var e = new VError(response.error, 'post saved but could cross post to facebook');
                return cb(e);
              }
              cb(null, post);
            }
          );
        });

      }
    ], function (err, post) {
      if (err) {
        var e = new WError(err, 'could not save post');
        server.locals.logger.error(e.toString());
        return res.send({
          'status': e.cause().message
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
