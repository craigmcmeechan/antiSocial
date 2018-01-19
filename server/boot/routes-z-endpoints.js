var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');

var resolveProfiles = require('../lib/resolveProfiles');
var resolveReactionsCommentsAndProfiles = require('../lib/resolveReactionsCommentsAndProfiles');
var resolveReactionsSummary = require('../lib/resolveReactionsSummary');
var resolveReactions = require('../lib/resolveReactions');
var resolveComments = require('../lib/resolveComments');
var resolveCommentsSummary = require('../lib/resolveCommentsSummary');
var resolvePostPhotos = require('../lib/resolvePostPhotos');
var encryption = require('../lib/encryption');
var uuid = require('uuid');
var url = require('url');
var uuid = require('uuid');
var async = require('async');
var _ = require('lodash');
var path = require('path');
var pug = require('pug');
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();

  // URL forms for getting posts and associated data from
  // the poster's authoritative server (users resident on this server)

  var profileRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)(\.json)?(\?.*)?$/;
  var postsRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/posts(\.json)?(\?.*)?$/;
  var postRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)(\.json)?$/;
  var postReactionsRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/reactions(\.json)?$/;
  var postCommentsRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/comments(\.json)?$/;
  var postCommentRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)(\.json)?$/;
  var postCommentReactionsRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)\/reactions(\.json)?$/;
  var postPhotosRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photos(\.json)?$/;
  var postPhotoRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)(\.json)?$/;
  var postPhotoReactionsRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/reactions(\.json)?$/;
  var postPhotoCommentsRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/comments(\.json)?$/;
  var postPhotoCommentRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)(\.json)?$/;
  var postPhotoCommentReactionsRE = /^\/((?!proxy-)[a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)\/reactions(\.json)?$/;

  function getPOVEndpoint(friend, currentUser) {
    if (friend) {
      return friend.remoteEndPoint;
    }
    if (currentUser) {
      return server.locals.config.publicHost + '/' + currentUser.username;
    }
  }

  router.get(profileRE, getCurrentUser(), checkNeedProxyRewrite('profile'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }
    var matches = req.url.match(profileRE);
    var username = matches[1];
    var view = matches[2];
    var accessToken = req.headers['friend-access-token'];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');
    var highwater = req.query.highwater;

    var isMe = false;

    getUser(username, function (err, user) {
      if (err) {
        return next(err);
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
          'backgroundSmall': server.locals.getUploadForProperty('background', user.uploads(), 'thumb', server.locals.FPO),
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
            getPosts(user, friend, highwater, isMe, function (err, posts) {
              cb(err, user, posts);
            });
          },
          function (user, posts, cb) {
            resolvePostPhotos(posts, function (err) {
              cb(err, user, posts);
            });
          },
          function (user, posts, cb) {
            resolveReactionsCommentsAndProfiles(posts, function (err) {
              cb(err, user, posts);
            });
          }
        ], function (err, user, posts) {
          data.posts = posts;
          data.highwater = data.posts && data.posts.length ? data.posts[data.posts.length - 1].createdOn.toISOString() : '';

          var options = {
            'data': data,
            'user': currentUser,

            'friend': friend,
            'isMe': isMe,
            'myEndpoint': getPOVEndpoint(friend, currentUser),
            'cache': true
          };

          if (data.posts && data.posts.length) {
            res.header('x-highwater', data.highwater);
          }

          renderFile('/components/rendered-profile.pug', options, req, function (err, html) {
            if (err) {
              return next(err);
            }
            return res.send(encryptIfFriend(friend, html));
          });
        });
      }
    });
  });

  router.get(postsRE, getCurrentUser(), checkNeedProxyRewrite('posts'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var matches = req.url.match(postsRE);
    var username = matches[1];
    var view = matches[2];
    var accessToken = req.headers['friend-access-token'];
    var highwater = req.query.highwater;
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');
    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
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
        resolvePostPhotos(posts, function (err) {
          cb(err, user, posts);
        });
      },
      function (user, posts, cb) {
        resolveReactionsCommentsAndProfiles(posts, function (err) {
          cb(err, user, posts);
        });
      }
    ], function (err, user, posts) {
      if (err) {
        return next(err);
      }

      var data = {
        'profile': {
          'name': user.name,
          'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
          'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
          'backgroundSmall': server.locals.getUploadForProperty('background', user.uploads(), 'thumb', server.locals.FPO),
          'endpoint': server.locals.config.publicHost + '/' + user.username,
          'publicHost': server.locals.config.publicHost
        },
        'posts': posts,
        'highwater': posts && posts.length ? posts[posts.length - 1].createdOn.toISOString() : ''
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'isMe': isMe,
        'myEndpoint': getPOVEndpoint(friend, currentUser),
        'cache': true
      };

      renderFile('/components/rendered-posts.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postRE, getCurrentUser(), checkNeedProxyRewrite('post'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }
    var matches = req.url.match(postRE);
    var username = matches[1];
    var postId = matches[2];
    var view = matches[3];
    var friend;
    var currentUser;
    var isMe = false;

    // special case - direct access to html view is 'permalink' which
    // should be the public view of the post
    if (view === '.json') {
      friend = ctx.get('friendAccess');
      currentUser = ctx.get('currentUser');
    }

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }
        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolvePostPhotos([post], function (err) {
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolveReactionsCommentsAndProfiles([post], function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var data = {
        'profile': {
          'name': user.name,
          'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
          'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
          'backgroundSmall': server.locals.getUploadForProperty('background', user.uploads(), 'thumb', server.locals.FPO),
          'endpoint': server.locals.config.publicHost + '/' + user.username,
          'publicHost': server.locals.config.publicHost
        },
        'post': post
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'isPermalink': true,
        'isMe': isMe,
        'myEndpoint': getPOVEndpoint(friend, currentUser),
        'cache': true
      };

      renderFile('/components/rendered-post.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postReactionsRE, getCurrentUser(), checkNeedProxyRewrite('post-reactions'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }
    var matches = req.url.match(postReactionsRE);

    var username = matches[1];
    var postId = matches[2];
    var view = matches[3];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }
        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {

        resolveProfiles(post, function (err) {
          cb(err, user, post);
        });
      },
      function (user, post, cb) {

        resolveReactions([post], 'post', function (err) {
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        async.map(post.resolvedReactions, resolveProfiles, function (err) {
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolveReactionsSummary(post, function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var data = {
        'post': post,
        'reactions': post.resolvedReactions ? post.resolvedReactions : [],
        'reactionSummary': post.reactionSummary,
        'poster': post.resolvedProfiles[post.source].profile
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'myEndpoint': getPOVEndpoint(friend, currentUser),
        'cache': true
      };

      renderFile('/components/rendered-post-reactions.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postCommentsRE, getCurrentUser(), checkNeedProxyRewrite('post-comments'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var matches = req.url.match(postCommentsRE);

    var username = matches[1];
    var postId = matches[2];
    var view = matches[3];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }

        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolveComments([post], 'post', function (err) {
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        var comments = typeof post.resolvedComments === 'function' ? post.resolvedComments() : post.resolvedComments;
        async.each(comments, resolveProfiles, function (err) {
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolveCommentsSummary(post, function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var data = {
        'post': post,
        'comments': post.resolvedComments ? post.resolvedComments : [],
        'commentSummary': post.commentSummary
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'cache': true
      };

      renderFile('/components/rendered-post-comments.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postCommentRE, getCurrentUser(), checkNeedProxyRewrite('post-comment'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var matches = req.url.match(postCommentRE);

    var username = matches[1];
    var postId = matches[2];
    var commentId = matches[3];
    var view = matches[4];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }

        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolveComments([post], 'post', function (err) {
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        var comments = typeof post.resolvedComments === 'function' ? post.resolvedComments() : post.resolvedComments;
        async.each(comments, resolveProfiles, function (err) {
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolveCommentsSummary(post, function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var theComment;
      for (var i = 0; i < post.resolvedComments.length; i++) {
        if (post.resolvedComments[i].uuid === commentId) {
          theComment = post.resolvedComments[i];
          break;
        }
      }

      if (!theComment) {
        var err = new Error('Comment not found');
        err.statusCode = 404;
        return next(err);
      }

      resolveProfiles(theComment, function (err) {

        var data = {
          'post': post,
          'comments': post.resolvedComments,
          'comment': theComment,
          'commentSummary': post.commentSummary
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        var options = {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'wantSummary': true,
          'cache': true
        };

        renderFile('/components/rendered-post-comment.pug', options, req, function (err, html) {
          if (err) {
            return next(err);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postCommentReactionsRE, getCurrentUser(), checkNeedProxyRewrite('post-comment-reactions'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var matches = req.url.match(postCommentReactionsRE);

    var username = matches[1];
    var postId = matches[2];
    var commentId = matches[3];
    var view = matches[4];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }

        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolveComments([post], 'post', function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var theComment;
      for (var i = 0; i < post.resolvedComments.length; i++) {
        if (post.resolvedComments[i].uuid === commentId) {
          theComment = post.resolvedComments[i];
          break;
        }
      }

      if (!theComment) {
        var e = new Error('Comment not found');
        e.statusCode = 404;
        return next(e);
      }

      async.map(theComment.resolvedReactions, resolveProfiles, function (err) {

        var data = {
          'post': post,
          'comment': theComment,
          'reactions': theComment.resolvedReactions ? theComment.resolvedReactions : [],
          'reactionSummary': theComment.reactionSummary
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        var options = {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'cache': true
        };

        renderFile('/components/rendered-post-comment-reactions.pug', options, req, function (err, html) {
          if (err) {
            return next(err);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postPhotosRE, getCurrentUser(), checkNeedProxyRewrite('post-photos'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var matches = req.url.match(postPhotosRE);

    var username = matches[1];
    var postId = matches[2];
    var view = matches[3];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }

        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolvePostPhotos([post], function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var data = {
        'post': post,
        'photos': post.sortedPhotos ? post.sortedPhotos : []
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'cache': true
      };

      renderFile('/components/rendered-post-photos.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postPhotoRE, getCurrentUser(), checkNeedProxyRewrite('post-photo'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var matches = req.url.match(postPhotoRE);

    var username = matches[1];
    var postId = matches[2];
    var photoId = matches[3];
    var view = matches[4];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }

        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolvePostPhotos([post], function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var thePhoto;

      for (var i = 0; i < post.sortedPhotos.length; i++) {
        if (post.sortedPhotos[i].uuid === photoId) {
          thePhoto = post.sortedPhotos[i];
          break;
        }
      }

      if (!thePhoto) {
        var e = new Error('Photo not found');
        e.statusCode = 404;
        return next(e);
      }

      var data = {
        'photo': thePhoto
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'cache': true
      };

      renderFile('/components/rendered-post-photo.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postPhotoReactionsRE, getCurrentUser(), checkNeedProxyRewrite('post-photo-reactions'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var matches = req.url.match(postPhotoReactionsRE);

    var username = matches[1];
    var postId = matches[2];
    var photoId = matches[3];
    var view = matches[4];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }

        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolvePostPhotos([post], function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var thePhoto;

      for (var i = 0; i < post.sortedPhotos.length; i++) {
        if (post.sortedPhotos[i].uuid === photoId) {
          thePhoto = post.sortedPhotos[i];
          break;
        }
      }

      if (!thePhoto) {
        var e = new Error('Photo not found');
        e.statusCode = 404;
        return next(e);
      }

      resolveReactions([thePhoto], 'photo', function (err) {

        var data = {
          'reactions': thePhoto.resolvedReactions
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        var options = {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'cache': true
        };

        renderFile('/components/rendered-post-photo-reactions.pug', options, req, function (err, html) {
          if (err) {
            return next(err);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postPhotoCommentsRE, getCurrentUser(), checkNeedProxyRewrite('post-photo-comments'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var matches = req.url.match(postPhotoCommentsRE);

    var username = matches[1];
    var postId = matches[2];
    var photoId = matches[3];
    var view = matches[4];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }

        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolvePostPhotos([post], function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var thePhoto;

      for (var i = 0; i < post.sortedPhotos.length; i++) {
        if (post.sortedPhotos[i].uuid === photoId) {
          thePhoto = post.sortedPhotos[i];
          break;
        }
      }

      if (!thePhoto) {
        var e = new Error('Photo not found');
        e.statusCode = 404;
        return next(e);
      }

      resolveComments([thePhoto], 'photo', function (err) {

        var data = {
          'comments': thePhoto.resolvedComments
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        var options = {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'cache': true
        };

        renderFile('/components/rendered-post-photo-comments.pug', options, req, function (err, html) {
          if (err) {
            return next(err);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });

    });
  });

  router.get(postPhotoCommentRE, getCurrentUser(), checkNeedProxyRewrite('post-photo-comment'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var matches = req.url.match(postPhotoCommentRE);

    var username = matches[1];
    var postId = matches[2];
    var photoId = matches[3];
    var commentId = matches[4];
    var view = matches[5];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }

        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolvePostPhotos([post], function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var thePhoto;

      for (var i = 0; i < post.sortedPhotos.length; i++) {
        if (post.sortedPhotos[i].uuid === photoId) {
          thePhoto = post.sortedPhotos[i];
          break;
        }
      }

      if (!thePhoto) {
        var e = new Error('Photo not found');
        e.statusCode = 404;
        return next(e);
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
          var e = new Error('Comment not found');
          e.statusCode = 404;
          return next(e);
        }

        var data = {
          'comment': theComment
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        var options = {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'cache': true
        };

        renderFile('/components/rendered-post-photo-comment.pug', options, req, function (err, html) {
          if (err) {
            return next(err);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postPhotoCommentReactionsRE, getCurrentUser(), checkNeedProxyRewrite('post-photo-comment-reactions'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var matches = req.url.match(postPhotoCommentReactionsRE);

    var username = matches[1];
    var postId = matches[2];
    var photoId = matches[3];
    var commentId = matches[4];
    var view = matches[5];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    var isMe = false;

    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          cb(err, user);
        });
      },
      function (user, cb) {
        if (currentUser) {
          if (currentUser.id.toString() === user.id.toString()) {
            isMe = true;
          }
        }

        getPost(postId, user, friend, isMe, function (err, post) {
          if (err) {
            return cb(err);
          }
          cb(err, user, post);
        });
      },
      function (user, post, cb) {
        resolvePostPhotos([post], function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var thePhoto;

      for (var i = 0; i < post.sortedPhotos.length; i++) {
        if (post.sortedPhotos[i].uuid === photoId) {
          thePhoto = post.sortedPhotos[i];
          break;
        }
      }

      if (!thePhoto) {
        var e = new Error('Photo not found');
        e.statusCode = 404;
        return next(e);
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
          var e = new Error('Comment not found');
          e.statusCode = 404;
          return next(e);
        }

        var data = {
          'reactions': theComment.resolvedReactions
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        var options = {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'cache': true
        };

        renderFile('/components/rendered-post-photo-comment-reactions.pug', options, req, function (err, html) {
          if (err) {
            return next(err);
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
      if (err) {
        return cb(err);
      }
      if (!user) {
        err = new Error('User Not Found');
        err.statusCode = 404;
        return cb(err);
      }
      cb(null, user);
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
      'limit': 10
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
          'lt': highwater
        }
      });
    }

    debug('getPosts: %j', query);

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
      }
    };

    if (!isMe) {
      query.where.and.push({
        'visibility': {
          'inq': friend && friend.audiences ? friend.audiences : ['public']
        }
      });
    }

    debug('getPost: %j', query);

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

  function renderFile(template, data, req, cb) {
    var ctx = req.myContext;

    var options = {};

    for (var prop in data) {
      options[prop] = data[prop];
    }

    for (var prop in server.locals) {
      options[prop] = server.locals[prop];
    }

    options.globalSettings = ctx.get('globalSettings');

    pug.renderFile(server.get('views') + template, options, function (err, html) {
      if (err) {
        return cb(err);
      }
      cb(null, html);
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
