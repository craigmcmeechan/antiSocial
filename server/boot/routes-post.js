var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var doPostNotifications = require('../lib/doPostNotifications');
var uuid = require('uuid');
var request = require('request');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var debug = require('debug')('communities');

module.exports = function (server) {
  var router = server.loopback.Router();

  /**
   * get a post for edit
   *
   * @name Get get a post for edit
   * @path {GET} /post/:postid
   * @params {String} postid is a valid post id owned by the logged in user
   * @auth With valid user credentials
   * @header {Cookie} access_token Request made by a logged in user on this server
   * @code {200} success
   * @code {404} post not found
   * @code {401} unauthorized
   * @response {HTML} html form for editing post
   */

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
        'post': post,
        'user': currentUser
      });
    });
  });


  /**
   * Edit a post
   *
   * @name POST Edit a post
   * @path {POST} /post/:postid
   * @auth With valid user credentials
   * @params {String} postid is a valid post id owned by the logged in user
   * @code {200} success
   * @code {404} post not found
   * @code {401} unauthorized
   * @body {String} body Body of the post in valid markdown
   * @body {String} geoDescription
   * @body {Object} geoLocation eg. {'type':'point','coordinates':[lng,lat]}
   * @body {Array} visibility Array of strings eg. ['public','friends']
   * @body {String} autopost date in gmt
   * @response {Object} result.status 'ok' or if error result.status has a human readable error message. eg. 'result': {'status': 'ok','flashLevel': 'success','flashMessage': 'saved'}
   */

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
          'tags': post.tags,
          'autopost': post.autopost
        });
        post.body = req.body.body;
        post.visibility = req.body.visibility;
        post.geoDescription = req.body.geoDescription;
        post.geoLocation = req.body.geoLocation;
        post.autopost = req.body.autopost;

        var postDescription = server.locals.marked(post.body);
        if (postDescription.match(/^<h\d[^>]*>([^<]*)/)) {
          postDescription = postDescription.match(/^<h\d[^>]*>([^<]*)/)[0];
        }
        postDescription = postDescription.replace(/<.*?>/g, '').replace(/\n/g, ' ');
        if (postDescription.length > 30) {
          postDescription = postDescription.substring(0, 30) + '...';
        }

        post.description = postDescription;

        post.save(function (err) {
          if (err) {
            cb(err);
          }
          cb(null, post);
        });
      },
      function getTags(post, cb) {
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
        }, function (err) {
          if (post.tags.length) {
            post.save();
          }
          cb(null, post);
        });
      },
      function updatePushNewsFeedItem(post, cb) {
        if (!post.posted) {
          return async.setImmediate(function () {
            cb(null, post);
          });
        }

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

          if (news) {
            news.tags = post.tags;
            news.visibility = post.visibility;
            news.description = post.description;
            news.save();
          }
          cb(null, post);
        });
      },
      function updateNewsFeedItem(post, cb) { // notify self
        if (!post.posted) {
          return async.setImmediate(function () {
            cb(null, post);
          });
        }

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
          if (news) {
            news.tags = post.tags;
            news.description = post.description;
            news.save();
          }
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


  /**
   * Delete a post
   *
   * @name Get Edit a post
   * @path {DELETE} /post/:postid
   * @params {String} postid is a valid post id owned by the logged in user
   * @auth With valid user credentials
   * @header {Cookie} access_token Request made by a logged in user on this server
   * @code {200} success
   * @code {404} post not found
   * @code {401} unauthorized
   * @response {Object} result.status: 'ok' or if error result.status has a human readable error message.
   */

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
            //console.log('deletePhotos', err, data);
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
            //console.log('deleteNewsFeedItems', err, data);
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

  /**
   * Create a post
   *
   * @name POST Edit a post
   * @path {POST} /post/
   * @auth With valid user credentials
   * @code {200} success
   * @code {404} post not found
   * @code {401} unauthorized
   * @body {String} body Body of the post in valid markdown
   * @body {String} geoDescription
   * @body {Object} geoLocation eg. {'type':'point','coordinates':[lng,lat]}
   * @body {Array} visibility Array of strings eg. ['public','friends']
   * @body {String} autopost date in gmt
   * @response {Object} result.status: 'ok' 'result.uuid': post.uuid
   }
   */
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
        if (req.body.autopost) {
          req.body.posted = false;
        }
        else {
          req.body.posted = true;
        }

        var postDescription = server.locals.marked(req.body.body);
        if (postDescription.match(/^<h\d[^>]*>([^<]*)/)) {
          postDescription = postDescription.match(/^<h\d[^>]*>([^<]*)/)[0];
        }
        postDescription = postDescription.replace(/<.*?>/g, '').replace(/\n/g, ' ');
        if (postDescription.length > 30) {
          postDescription = postDescription.substring(0, 30) + '...';
        }

        req.body.description = postDescription;

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
          return async.setImmediate(function () {
            cb(null, post, null);
          });
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
          return async.setImmediate(function () {
            cb(null, post);
          });
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
      function getTags(post, cb) { // set tags
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
        }, function (err) {
          if (post.tags.length) {
            post.save();
          }
          cb(null, post);
        });
      },
      function (post, cb) { // do notifications
        doPostNotifications(currentUser, post, function (err, post) {
          cb(err, post);
        });
      },
      function (post, cb) {
        // look for communities in audiences
        async.mapSeries(post.visibility, function (channel, doneAudiences) {
          var matches = channel.match(/^community-([0-9a-zA-Z-]+)/);
          if (!matches) {
            return async.setImmediate(function () { // not a community
              doneAudiences();
            });
          }

          var subscriptions = [];

          for (var i = 0; i < currentUser.subscriptions().length; i++) {
            var subscription = currentUser.subscriptions()[i];
            if (subscription.communityName === matches[1]) {
              subscriptions.push(subscription);
            }
          }

          // post notification to all selected community subscription endpoint(s)
          async.mapSeries(subscriptions, function (subscription, donePostToCommunity) {
            var visibility = [];
            visibility.push('community-' + subscription.communityName);
            if (post.visibility.indexOf('public') !== -1) {
              visibility.push('public');
            }
            var payload = {
              'source': post.source,
              'visibility': post.visibility,
              'athoritativeEndpoint': post.source + '/post/' + post.uuid
            };

            var options = {
              'url': fixIfBehindProxy(subscription.remoteEndPoint + '/post'),
              'headers': {
                'community-access-token': subscription.remoteAccessToken
              },
              'form': payload,
              'json': true
            };

            request.post(options, function (err, response, body) {
              donePostToCommunity(err);
            });

          }, function (err) {
            doneAudiences(err);
          });

        }, function (err) {
          cb(err, post);
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
        'result': {
          'status': 'ok',
          'uuid': post.uuid
        }
      });
    });
  });

  server.use(router);

  function fixIfBehindProxy(url) {
    if (process.env.BEHIND_PROXY === "true") {
      var rx = new RegExp('^' + server.locals.config.publicHost);
      if (url.match(rx)) {
        url = url.replace(server.locals.config.publicHost, 'http://localhost:' + server.locals.config.port);
        debug('bypass proxy ' + url);
      }
    }
    return url;
  }
};
