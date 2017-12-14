var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var resolveProfiles = require('../lib/resolveProfiles');
var resolveReactionsCommentsAndProfiles = require('../lib/resolveReactionsCommentsAndProfiles');
var resolveReactions = require('../lib/resolveReactions');
var resolveComments = require('../lib/resolveComments');
var resolvePostPhotos = require('../lib/resolvePostPhotos');
var qs = require('querystring');
var encryption = require('../lib/encryption');
var uuid = require('uuid');
var url = require('url');
var uuid = require('uuid');
var async = require('async');
var _ = require('lodash');
var path = require('path');
var pug = require('pug');

var VError = require('verror').VError;
var WError = require('verror').WError;
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();

  // URL forms for getting posts and associated data from
  // the poster's authoritative server (users resident on this server)

  var profileRE = /^\/([a-zA-Z0-9\-]+)(\.json)?$/;
  var postsRE = /^\/([a-zA-Z0-9\-]+)\/posts(\.json)?$/;
  var postRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)(\.json)?$/;
  var postReactionsRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/reactions(\.json)?$/;
  var postCommentsRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/comments(\.json)?$/;
  var postCommentRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)(\.json)?$/;
  var postCommentReactionsRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)\/reactions(\.json)?$/;
  var postPhotosRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photos(\.json)?$/;
  var postPhotoRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)(\.json)?$/;
  var postPhotoReactionsRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/reactions(\.json)?$/;
  var postPhotoCommentsRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/comments(\.json)?$/;
  var postPhotoCommentRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)(\.json)?$/;
  var postPhotoCommentReactionsRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)\/reactions(\.json)?$/;

  router.get(profileRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(profileRE);
    var username = matches[1];
    var view = matches[2];
    var accessToken = req.headers['friend-access-token'];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    getUser(username, function (err, user) {

      if (err || !user) {
        return res.sendStatus('404');
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      var data = {
        'profile': {
          'name': user.name,
          'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
          'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
          'endpoint': server.locals.config.publicHost + '/' + user.username,
          'publicHost': server.locals.config.publicHost
        }
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }
      else {
        async.waterfall([
          function (cb) {
            if (!user) {
              return process.nextTick(function () {
                cb();
              });
            }
            getPosts(user, friend, null, isMe, function (err, posts) {
              cb(err, user, posts);
            });
          },
          function (user, posts, cb) {
            if (!posts) {
              return process.nextTick(function () {
                cb();
              });
            }
            resolvePostPhotos(posts, function (err) {
              cb(err, user, posts);
            });
          },
          function (user, posts, cb) {
            if (!posts) {
              return process.nextTick(function () {
                cb();
              });
            }
            resolveReactionsCommentsAndProfiles(posts, function (err) {
              cb(err, user, posts);
            });
          }
        ], function (err, user, posts) {
          data.posts = posts;

          var options = {
            'data': data,
            'user': currentUser,
            'friend': friend,
            'moment': server.locals.moment,
            'marked': server.locals.marked,
            'headshotFPO': server.locals.headshotFPO,
            'getUploadForProperty': server.locals.getUploadForProperty,
            'environment': server.locals.environment,
            'globalSettings': ctx.get('globalSettings'),
            'isMe': isMe
          };

          pug.renderFile(server.get('views') + '/components/rendered-profile.pug', options, function (err, html) {
            if (err) {
              console.log(err);
              return res.sendStatus(500);
            }
            return res.send(encryptIfFriend(friend, html));
          });
        });
      }
    });
  });

  router.get(postsRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postsRE);
    var username = matches[1];
    var view = matches[2];
    var accessToken = req.headers['friend-access-token'];
    var highwater = req.headers['friend-high-water'];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          cb(err, user);
        });
      },
      function (user, cb) {
        if (!user) {
          return process.nextTick(function () {
            cb();
          });
        }
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }
        getPosts(user, friend, highwater, isMe, function (err, posts) {
          cb(err, user, posts);
        });
      },
      function (user, posts, cb) {
        if (!posts) {
          return process.nextTick(function () {
            cb();
          });
        }
        resolvePostPhotos(posts, function (err) {
          cb(err, user, posts);
        });
      },
      function (user, posts, cb) {
        if (!posts) {
          return process.nextTick(function () {
            cb();
          });
        }
        resolveReactionsCommentsAndProfiles(posts, function (err) {
          cb(err, user, posts);
        });
      }
    ], function (err, user, posts) {
      var data = {
        'profile': {
          'name': user.name,
          'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
          'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
          'endpoint': server.locals.config.publicHost + '/' + user.username,
          'publicHost': server.locals.config.publicHost
        },
        'posts': posts
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      pug.renderFile(server.get('views') + '/components/rendered-posts.pug', {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'moment': server.locals.moment,
        'marked': server.locals.marked,
        'headshotFPO': server.locals.headshotFPO,
        'getUploadForProperty': server.locals.getUploadForProperty,
        'environment': server.locals.environment,
        'globalSettings': ctx.get('globalSettings'),
        'isMe': isMe
      }, function (err, html) {
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postRE);
    var username = matches[1];
    var postId = matches[2];
    var view = matches[3];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err || !user) {
            var e = new VError('user not found');
            return cb(e);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (!user) {
          return process.nextTick(function () {
            cb();
          });
        }
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }
        getPost(postId, user, friend, isMe, function (err, post) {
          if (err || !post) {
            var e = new VError('post not found');
            return cb(e);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        if (!post) {
          return process.nextTick(function () {
            cb();
          });
        }
        resolvePostPhotos([post], function (err) {
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        if (!post) {
          return process.nextTick(function () {
            cb();
          });
        }
        resolveReactionsCommentsAndProfiles([post], function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (!post) {
        return res.sendStatus(404);
      }

      var data = {
        'profile': {
          'name': user.name,
          'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
          'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
          'endpoint': server.locals.config.publicHost + '/' + user.username,
          'publicHost': server.locals.config.publicHost
        },
        'post': post
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      pug.renderFile(server.get('views') + '/components/rendered-post.pug', {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'moment': server.locals.moment,
        'marked': server.locals.marked,
        'headshotFPO': server.locals.headshotFPO,
        'getUploadForProperty': server.locals.getUploadForProperty,
        'environment': server.locals.environment,
        'globalSettings': ctx.get('globalSettings'),
        'isPermalink': true,
        'isMe': isMe
      }, function (err, html) {
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postReactionsRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postReactionsRE);

    var username = matches[1];
    var postId = matches[2];
    var view = matches[3];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([function (cb) {
      getUser(username, function (err, user) {
        cb(err, user);
      });
    }, function (user, cb) {
      if (!user) {
        return process.nextTick(function () {
          cb();
        });
      }
      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }
      getPost(postId, user, friend, isMe, function (err, post) {
        cb(err, user, post);
      });
    }, function (user, post, cb) {
      if (!post) {
        return process.nextTick(function () {
          cb();
        });
      }
      resolveReactions([post], 'post', function (err) {
        cb(err, user, post);
      });
    }], function (err, user, post) {
      if (err) {
        return res.sendStatus(500);
      }
      if (!user || !post) {
        return res.sendStatus(404);
      }

      async.map(post.resolvedReactions, resolveProfiles, function (err) {

        var data = {
          'reactions': post.resolvedReactions ? post.resolvedReactions : []
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        pug.renderFile(server.get('views') + '/components/rendered-post-reactions.pug', {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'moment': server.locals.moment,
          'marked': server.locals.marked,
          'headshotFPO': server.locals.headshotFPO,
          'getUploadForProperty': server.locals.getUploadForProperty,
          'environment': server.locals.environment,
          'globalSettings': ctx.get('globalSettings')
        }, function (err, html) {
          if (err) {
            return res.sendStatus(500);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postCommentsRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postCommentsRE);

    var username = matches[1];
    var postId = matches[2];
    var view = matches[3];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([function (cb) {
      getUser(username, function (err, user) {
        cb(err, user);
      });
    }, function (user, cb) {
      if (!user) {
        return process.nextTick(function () {
          cb();
        });
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      getPost(postId, user, friend, isMe, function (err, post) {
        cb(err, user, post);
      });
    }, function (user, post, cb) {
      if (!post) {
        return process.nextTick(function () {
          cb();
        });
      }
      resolveComments([post], 'post', function (err) {
        cb(err, user, post);
      });
    }], function (err, user, post) {
      if (err) {
        return res.sendStatus(500);
      }
      if (!user || !post) {
        return res.sendStatus(404);
      }

      async.map(post.resolvedComments, resolveProfiles, function (err) {
        var data = {
          'comments': post.resolvedComments ? post.resolvedComments : []
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        pug.renderFile(server.get('views') + '/components/rendered-post-comments.pug', {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'moment': server.locals.moment,
          'marked': server.locals.marked,
          'headshotFPO': server.locals.headshotFPO,
          'getUploadForProperty': server.locals.getUploadForProperty,
          'environment': server.locals.environment,
          'globalSettings': ctx.get('globalSettings')
        }, function (err, html) {
          if (err) {
            return res.sendStatus(500);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postCommentRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postCommentRE);

    var username = matches[1];
    var postId = matches[2];
    var commentId = matches[3];
    var view = matches[4];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([function (cb) {
      getUser(username, function (err, user) {
        cb(err, user);
      });
    }, function (user, cb) {
      if (!user) {
        return process.nextTick(function () {
          cb();
        });
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      getPost(postId, user, friend, isMe, function (err, post) {
        cb(err, user, post);
      });
    }, function (user, post, cb) {
      if (!post) {
        return process.nextTick(function () {
          cb();
        });
      }
      resolveComments([post], 'post', function (err) {
        cb(err, user, post);
      });
    }], function (err, user, post) {
      if (err) {
        return res.sendStatus(500);
      }
      if (!user || !post) {
        return res.sendStatus(404);
      }

      var theComment;
      for (var i = 0; i < post.resolvedComments.length; i++) {
        if (post.resolvedComments[i].uuid === commentId) {
          theComment = post.resolvedComments[i];
          break;
        }
      }

      if (!theComment) {
        return res.sendStatus(404);
      }

      resolveProfiles(theComment, function (err) {

        var data = {
          'comment': theComment
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        pug.renderFile(server.get('views') + '/components/rendered-post-comment.pug', {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'moment': server.locals.moment,
          'marked': server.locals.marked,
          'headshotFPO': server.locals.headshotFPO,
          'getUploadForProperty': server.locals.getUploadForProperty,
          'environment': server.locals.environment,
          'globalSettings': ctx.get('globalSettings')
        }, function (err, html) {
          if (err) {
            return res.sendStatus(500);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postCommentReactionsRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postCommentReactionsRE);

    var username = matches[1];
    var postId = matches[2];
    var commentId = matches[3];
    var view = matches[4];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([function (cb) {
      getUser(username, function (err, user) {
        cb(err, user);
      });
    }, function (user, cb) {
      if (!user) {
        return process.nextTick(function () {
          cb();
        });
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      getPost(postId, user, friend, isMe, function (err, post) {
        cb(err, user, post);
      });
    }, function (user, post, cb) {
      if (!post) {
        return process.nextTick(function () {
          cb();
        });
      }
      resolveComments([post], 'post', function (err) {
        cb(err, user, post);
      });
    }], function (err, user, post) {
      if (err) {
        return res.sendStatus(500);
      }
      if (!user || !post) {
        return res.sendStatus(404);
      }

      var theComment;
      for (var i = 0; i < post.resolvedComments.length; i++) {
        if (post.resolvedComments[i].uuid === commentId) {
          theComment = post.resolvedComments[i];
          break;
        }
      }

      if (!theComment) {
        return res.sendStatus(404);
      }

      async.map(theComment.resolvedReactions, resolveProfiles, function (err) {

        var data = {
          'commentReactions': theComment.resolvedReactions ? theComment.resolvedReactions : []
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        pug.renderFile(server.get('views') + '/components/rendered-post-comment-reactions.pug', {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'moment': server.locals.moment,
          'marked': server.locals.marked,
          'headshotFPO': server.locals.headshotFPO,
          'getUploadForProperty': server.locals.getUploadForProperty,
          'environment': server.locals.environment,
          'globalSettings': ctx.get('globalSettings')
        }, function (err, html) {
          if (err) {
            return res.sendStatus(500);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postPhotosRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postPhotosRE);

    var username = matches[1];
    var postId = matches[2];
    var view = matches[3];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([function (cb) {
      getUser(username, function (err, user) {
        cb(err, user);
      });
    }, function (user, cb) {
      if (!user) {
        return process.nextTick(function () {
          cb();
        });
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      getPost(postId, user, friend, isMe, function (err, post) {
        cb(err, user, post);
      });
    }, function (user, post, cb) {
      if (!post) {
        return process.nextTick(function () {
          cb();
        });
      }
      resolvePostPhotos([post], function (err) {
        cb(err, user, post);
      });
    }], function (err, user, post) {
      if (err) {
        return res.sendStatus(500);
      }
      if (!user || !post) {
        return res.sendStatus(404);
      }

      var data = {
        'photos': post.sortedPhotos ? post.sortedPhotos : []
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      pug.renderFile(server.get('views') + '/components/rendered-post-photos.pug', {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'moment': server.locals.moment,
        'marked': server.locals.marked,
        'headshotFPO': server.locals.headshotFPO,
        'getUploadForProperty': server.locals.getUploadForProperty,
        'environment': server.locals.environment,
        'globalSettings': ctx.get('globalSettings')
      }, function (err, html) {
        if (err) {
          return res.sendStatus(500);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postPhotoRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postPhotoRE);

    var username = matches[1];
    var postId = matches[2];
    var photoId = matches[3];
    var view = matches[4];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([function (cb) {
      getUser(username, function (err, user) {
        cb(err, user);
      });
    }, function (user, cb) {
      if (!user) {
        return process.nextTick(function () {
          cb();
        });
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      getPost(postId, user, friend, isMe, function (err, post) {
        cb(err, user, post);
      });
    }, function (user, post, cb) {
      if (!post) {
        return process.nextTick(function () {
          cb();
        });
      }
      resolvePostPhotos([post], function (err) {
        cb(err, user, post);
      });
    }], function (err, user, post) {
      if (err) {
        return res.sendStatus(500);
      }
      if (!user || !post) {
        return res.sendStatus(404);
      }

      var thePhoto;

      for (var i = 0; i < post.sortedPhotos.length; i++) {
        if (post.sortedPhotos[i].uuid === photoId) {
          thePhoto = post.sortedPhotos[i];
          break;
        }
      }

      if (!thePhoto) {
        return res.sendStatus(404);
      }

      var data = {
        'photo': thePhoto
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      pug.renderFile(server.get('views') + '/components/rendered-post-photo.pug', {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'moment': server.locals.moment,
        'marked': server.locals.marked,
        'headshotFPO': server.locals.headshotFPO,
        'getUploadForProperty': server.locals.getUploadForProperty,
        'environment': server.locals.environment,
        'globalSettings': ctx.get('globalSettings')
      }, function (err, html) {
        if (err) {
          return res.sendStatus(500);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postPhotoReactionsRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postPhotoReactionsRE);

    var username = matches[1];
    var postId = matches[2];
    var photoId = matches[3];
    var view = matches[4];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([function (cb) {
      getUser(username, function (err, user) {
        cb(err, user);
      });
    }, function (user, cb) {
      if (!user) {
        return process.nextTick(function () {
          cb();
        });
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      getPost(postId, user, friend, isMe, function (err, post) {
        cb(err, user, post);
      });
    }, function (user, post, cb) {
      if (!post) {
        return process.nextTick(function () {
          cb();
        });
      }
      resolvePostPhotos([post], function (err) {
        cb(err, user, post);
      });
    }], function (err, user, post) {
      if (err) {
        return res.sendStatus(500);
      }
      if (!user || !post) {
        return res.sendStatus(404);
      }

      var thePhoto;

      for (var i = 0; i < post.sortedPhotos.length; i++) {
        if (post.sortedPhotos[i].uuid === photoId) {
          thePhoto = post.sortedPhotos[i];
          break;
        }
      }

      if (!thePhoto) {
        return res.sendStatus(404);
      }

      resolveReactions([thePhoto], 'photo', function (err) {

        var data = {
          'reactions': thePhoto.resolvedReactions
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        pug.renderFile(server.get('views') + '/components/rendered-post-photo-reactions.pug', {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'moment': server.locals.moment,
          'marked': server.locals.marked,
          'headshotFPO': server.locals.headshotFPO,
          'getUploadForProperty': server.locals.getUploadForProperty,
          'environment': server.locals.environment,
          'globalSettings': ctx.get('globalSettings')
        }, function (err, html) {
          if (err) {
            return res.sendStatus(500);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });

    });
  });

  router.get(postPhotoCommentsRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postPhotoCommentsRE);

    var username = matches[1];
    var postId = matches[2];
    var photoId = matches[3];
    var view = matches[4];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([function (cb) {
      getUser(username, function (err, user) {
        cb(err, user);
      });
    }, function (user, cb) {
      if (!user) {
        return process.nextTick(function () {
          cb();
        });
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      getPost(postId, user, friend, isMe, function (err, post) {
        cb(err, user, post);
      });
    }, function (user, post, cb) {
      if (!post) {
        return process.nextTick(function () {
          cb();
        });
      }
      resolvePostPhotos([post], function (err) {
        cb(err, user, post);
      });
    }], function (err, user, post) {
      if (err) {
        return res.sendStatus(500);
      }
      if (!user || !post) {
        return res.sendStatus(404);
      }

      var thePhoto;

      for (var i = 0; i < post.sortedPhotos.length; i++) {
        if (post.sortedPhotos[i].uuid === photoId) {
          thePhoto = post.sortedPhotos[i];
          break;
        }
      }

      if (!thePhoto) {
        return res.sendStatus(404);
      }

      resolveComments([thePhoto], 'photo', function (err) {

        var data = {
          'comments': thePhoto.resolvedComments
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        pug.renderFile(server.get('views') + '/components/rendered-post-photo-comments.pug', {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'moment': server.locals.moment,
          'marked': server.locals.marked,
          'headshotFPO': server.locals.headshotFPO,
          'getUploadForProperty': server.locals.getUploadForProperty,
          'environment': server.locals.environment,
          'globalSettings': ctx.get('globalSettings')
        }, function (err, html) {
          if (err) {
            return res.sendStatus(500);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });

    });
  });

  router.get(postPhotoCommentRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postPhotoCommentRE);

    var username = matches[1];
    var postId = matches[2];
    var photoId = matches[3];
    var commentId = matches[4];
    var view = matches[5];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([function (cb) {
      getUser(username, function (err, user) {
        cb(err, user);
      });
    }, function (user, cb) {
      if (!user) {
        return process.nextTick(function () {
          cb();
        });
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      getPost(postId, user, friend, isMe, function (err, post) {
        cb(err, user, post);
      });
    }, function (user, post, cb) {
      if (!post) {
        return process.nextTick(function () {
          cb();
        });
      }
      resolvePostPhotos([post], function (err) {
        cb(err, user, post);
      });
    }], function (err, user, post) {
      if (err) {
        return res.sendStatus(500);
      }
      if (!user || !post) {
        return res.sendStatus(404);
      }

      var thePhoto;

      for (var i = 0; i < post.sortedPhotos.length; i++) {
        if (post.sortedPhotos[i].uuid === photoId) {
          thePhoto = post.sortedPhotos[i];
          break;
        }
      }

      if (!thePhoto) {
        return res.sendStatus(404);
      }

      thePhoto.about = post.source + '/post/' + post.uuid;
      resolveComments([thePhoto], 'photo', function (err) {

        var theComment;
        for (var i = 0; i < thePhoto.resolvedComments.length; i++) {
          if (thePhoto.resolvedComments[i].uuid === commentId) {
            theComment = thePhoto.resolvedComments[i];
            break;
          }
        }

        if (!theComment) {
          return res.sendStatus(404);
        }

        var data = {
          'comment': theComment
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        pug.renderFile(server.get('views') + '/components/rendered-post-photo-comment.pug', {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'moment': server.locals.moment,
          'marked': server.locals.marked,
          'headshotFPO': server.locals.headshotFPO,
          'getUploadForProperty': server.locals.getUploadForProperty,
          'environment': server.locals.environment,
          'globalSettings': ctx.get('globalSettings')
        }, function (err, html) {
          if (err) {
            return res.sendStatus(500);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postPhotoCommentReactionsRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(postPhotoCommentReactionsRE);

    var username = matches[1];
    var postId = matches[2];
    var photoId = matches[3];
    var commentId = matches[4];
    var view = matches[5];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([function (cb) {
      getUser(username, function (err, user) {
        cb(err, user);
      });
    }, function (user, cb) {
      if (!user) {
        return process.nextTick(function () {
          cb();
        });
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      getPost(postId, user, friend, isMe, function (err, post) {
        cb(err, user, post);
      });
    }, function (user, post, cb) {
      if (!post) {
        return process.nextTick(function () {
          cb();
        });
      }
      resolvePostPhotos([post], function (err) {
        cb(err, user, post);
      });
    }], function (err, user, post) {
      if (err) {
        return res.sendStatus(500);
      }
      if (!user || !post) {
        return res.sendStatus(404);
      }

      var thePhoto;

      for (var i = 0; i < post.sortedPhotos.length; i++) {
        if (post.sortedPhotos[i].uuid === photoId) {
          thePhoto = post.sortedPhotos[i];
          break;
        }
      }

      if (!thePhoto) {
        return res.sendStatus(404);
      }

      thePhoto.about = post.source + '/post/' + post.uuid;
      resolveComments([thePhoto], 'photo', function (err) {

        var theComment;
        for (var i = 0; i < thePhoto.resolvedComments.length; i++) {
          if (thePhoto.resolvedComments[i].uuid === commentId) {
            theComment = thePhoto.resolvedComments[i];
            break;
          }
        }

        if (!theComment) {
          return res.sendStatus(404);
        }

        var data = {
          'reactions': theComment.resolvedReactions
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        pug.renderFile(server.get('views') + '/components/rendered-post-photo-comment-reactions.pug', {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'moment': server.locals.moment,
          'marked': server.locals.marked,
          'headshotFPO': server.locals.headshotFPO,
          'getUploadForProperty': server.locals.getUploadForProperty,
          'environment': server.locals.environment,
          'globalSettings': ctx.get('globalSettings')
        }, function (err, html) {
          if (err) {
            return res.sendStatus(500);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  function getUser(username, cb) {
    server.models.MyUser.findOne({
      'where': {
        'username': username
      },
      'include': ['uploads']
    }, function (err, user) {
      cb(err, user);
    });
  }

  function getPosts(user, friend, highwater, isMe, cb) {

    var query = {
      'where': {
        'and': [{
          'userId': user.id
        }]
      },
      'order': 'createdOn DESC',
      'limit': 10,
      'include': [{
        'user': ['uploads']
      }]
    };

    if (!isMe) {
      query.where.and.push({
        'visibility': {
          'inq': friend && friend.audiences ? friend.audiences : ['public']
        }
      });
    }

    if (highwater) {
      query.where.and.push({
        'createdOn': {
          'gt': highwater
        }
      });
    }

    server.models.Post.find(query, function (err, posts) {
      if (err) {
        return cb(err);
      }

      cb(err, posts);
    });
  }

  function getPost(postId, user, friend, isMe, cb) {
    var query = {
      'where': {
        'and': [{
          'uuid': postId
        }, {
          'userId': user.id
        }]
      },
      'order': 'createdOn DESC',
      'limit': 30,
      'include': [{
        'user': ['uploads']
      }, {
        'photos': ['uploads']
      }]
    };

    if (!isMe) {
      query.where.and.push({
        'visibility': {
          'inq': friend && friend.audiences ? friend.audiences : ['public']
        }
      });
    }

    server.models.Post.findOne(query, function (err, post) {
      if (err || !post) {
        return cb(err);
      }

      cb(null, post);
    });
  }

  server.use(router);
};

function encryptIfFriend(friend, payload) {
  if (friend) {
    var privateKey = friend.keys.private;
    var publicKey = friend.remotePublicKey;
    var encrypted = encryption.encrypt(publicKey, privateKey, JSON.stringify(payload));

    payload = {
      'data': encrypted.data,
      'sig': encrypted.sig,
      'pass': encrypted.pass
    };
  }

  return payload;
}
