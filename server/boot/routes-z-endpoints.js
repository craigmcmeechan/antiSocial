var getCurrentUser = require('../middleware/context-currentUser');
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
var async = require('async');
var pug = require('pug');
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');
var request = require('request');
var graphlib = require('graphlib');

module.exports = function (server) {
  var router = server.loopback.Router();

  // URL forms for getting posts and associated data from
  // the poster's authoritative server (users resident on this server)

  var profileRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)(\.json)?(\?.*)?$/;
  var friendsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/friends(\.json)?$/;
  var photosRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/photos(\.json)?$/;
  var postsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/posts(\.json)?(\?.*)?$/;
  var postRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)(\.json)?(\?embed=1)?$/;
  var postReactionsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/reactions(\.json)?$/;
  var postCommentsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/comments(\.json)?$/;
  var postCommentRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/comment\/([a-f0-9-]+)(\.json)?$/;
  var postCommentReactionsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/comment\/([a-f0-9-]+)\/reactions(\.json)?$/;
  var postPhotosRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/photos(\.json)?$/;
  var postPhotoRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/photo\/([a-f0-9-]+)(\.json)?$/;
  var postPhotoReactionsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/photo\/([a-f0-9-]+)\/reactions(\.json)?$/;
  var postPhotoCommentsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/photo\/([a-f0-9-]+)\/comments(\.json)?$/;
  var postPhotoCommentRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/photo\/([a-f0-9-]+)\/comment\/([a-f0-9-]+)(\.json)?$/;
  var postPhotoCommentReactionsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/post\/([a-f0-9-]+)\/photo\/([a-f0-9-]+)\/comment\/([a-f0-9-]+)\/reactions(\.json)?$/;
  var photoRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/photo\/([a-f0-9-]+)(\.json)?$/;

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
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');
    var highwater = req.query.highwater;
    var tags = req.query.tags;

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
        'pov': {
          'user': user.username,
          'isMe': isMe,
          'friend': friend ? friend.remoteUsername : false,
          'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
        },
        'profile': getProfile(user)
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }
      else {
        async.waterfall([
          function (cb) {
            getPosts(user, friend, highwater, isMe, tags, function (err, posts) {
              cb(err, user, posts);
            });
          },
          function (user, posts, cb) {
            resolvePostPhotos(posts, function (err) {
              cb(err, user, posts);
            });
          },
          function (user, posts, cb) {
            resolveReactionsCommentsAndProfiles(posts, isMe, function (err) {
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
            'inviteToken': req.signedCookies.invite
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

  router.get(photosRE, getCurrentUser(), checkNeedProxyRewrite('photos'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }
    var currentUser = ctx.get('currentUser');
    var friend = ctx.get('friendAccess');

    var matches = req.url.match(photosRE);
    var username = matches[1];
    var view = matches[2];

    var isMe = false;
    async.waterfall([
      function (cb) {
        getUser(username, function (err, user) {
          if (err) {
            return cb(err);
          }
          if (currentUser) {
            if (currentUser.id.toString() === user.id.toString()) {
              isMe = true;
            }
          }

          if (!friend && !isMe) {
            var error = new Error('access denied');
            error.httpStatusCode = 401;
            cb(error);
          }

          cb(err, user);
        });
      },
      function (user, cb) {
        var query = {
          'where': {
            'userId': user.id
          },
          'include': ['uploads']
        };

        server.models.Photo.find(query, function (err, photos) {
          cb(err, user, photos);
        });
      }
    ], function (err, user, photos) {
      if (err) {
        return next(err);
      }

      var data = {
        'pov': {
          'user': user.username,
          'isMe': isMe,
          'friend': friend ? friend.remoteUsername : false,
          'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
        },
        'profile': getProfile(user),
        'photos': photos
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'isMe': isMe,
        'myEndpoint': getPOVEndpoint(friend, currentUser)
      };

      renderFile('/components/rendered-photos.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(friendsRE, getCurrentUser(), checkNeedProxyRewrite('friends'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }

    var currentUser = ctx.get('currentUser');
    var friend = ctx.get('friendAccess');

    var matches = req.url.match(friendsRE);
    var username = matches[1];
    var view = matches[2];

    var isMe = false;
    var endpoints = [];
    var map = {};

    getUser(username, function (err, user) {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.sendStatus(404);
      }

      if (currentUser) {
        if (currentUser.id.toString() === user.id.toString()) {
          isMe = true;
        }
      }

      // only logged in user or friends can access frields list
      if (!friend && !isMe) {
        return res.sendStatus(401);
      }

      if (isMe) { // get all friends of my friends
        var g = new graphlib.Graph({
          directed: false
        });

        var query = {
          'where': {
            'and': [{
              'userId': currentUser.id
            }, {
              'status': 'accepted'
            }]
          }
        };

        server.models.Friend.find(query, function (err, friends) {

          g.setNode(server.locals.config.publicHost + '/' + currentUser.username, {
            'name': currentUser.username
          });

          for (var i = 0; i < friends.length; i++) {
            g.setNode(friends[i].remoteEndPoint, {
              'name': friends[i].remoteUsername
            });
          }

          async.map(friends, function (friend, cb) {

            var options = {
              'url': friend.remoteEndPoint + '/friends.json',
              'headers': {
                'friend-access-token': friend.remoteAccessToken
              },
              'json': true
            };

            request.get(options, function (err, response, body) {

              if (err || response.statusCode !== 200) {
                return cb(); // ignore error?
              }

              var data = body;

              if (friend && body.sig) {
                debug('got encrypted response');
                var privateKey = friend.keys.private;
                var publicKey = friend.remotePublicKey;
                var toDecrypt = body.data;
                var sig = body.sig;
                var pass = body.pass;

                var decrypted = encryption.decrypt(publicKey, privateKey, toDecrypt, pass, sig);
                if (!decrypted.valid) {
                  return res.sendStatus('401');
                }
                data = JSON.parse(decrypted.data);
              }

              if (data.friends && data.friends.nodes) {
                for (var i = 0; i < data.friends.nodes.length; i++) {
                  var node = data.friends.nodes[i];
                  if (!g.hasNode(node.v)) {
                    g.setNode(node.v, {
                      'name': node.value.name
                    });
                  }
                }
                for (var i = 0; i < data.friends.edges.length; i++) {
                  var edge = data.friends.edges[i];
                  g.setEdge(edge.v, edge.w);
                }
              }

              cb();

            });
          }, function (err) {
            var results = graphlib.json.write(g);
            async.map(results.nodes, function (node, cb) {
              node.about = node.v;
              resolveProfiles(node, cb);
            }, function (err) {

              var data = {
                'pov': {
                  'user': user.username,
                  'isMe': isMe,
                  'friend': friend ? friend.remoteUsername : false,
                  'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
                },
                'me': server.locals.config.publicHost + '/' + currentUser.username,
                'friends': results
              };

              if (view === '.json') {
                return res.send(encryptIfFriend(friend, data));
              }
              else {
                var options = {
                  'data': data,
                  'user': currentUser,
                  'friend': friend,
                  'isMe': isMe,
                  'myEndpoint': getPOVEndpoint(friend, currentUser)
                };

                renderFile('/components/rendered-friends.pug', options, req, function (err, html) {
                  if (err) {
                    return next(err);
                  }
                  return res.send(encryptIfFriend(friend, html));
                });
              }
            });
          });
        });
      }
      else { // get friends
        var g = new graphlib.Graph({
          directed: false
        });

        var query = {
          'where': {
            'and': [{
              'userId': user.id
            }, {
              'status': 'accepted'
            }]
          }
        };

        server.models.Friend.find(query, function (err, friends) {

          g.setNode(server.locals.config.publicHost + '/' + user.username, {
            'name': user.username
          });

          for (var i = 0; i < friends.length; i++) {
            g.setNode(friends[i].remoteEndPoint, {
              'name': friends[i].remoteUsername
            });

            g.setEdge(server.locals.config.publicHost + '/' + user.username, friends[i].remoteEndPoint)

          }

          var data = {
            'pov': {
              'user': user.username,
              'isMe': isMe,
              'friend': friend ? friend.remoteUsername : false,
              'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
            },
            'friends': graphlib.json.write(g)
          };

          if (view === '.json') {
            return res.send(encryptIfFriend(friend, data));
          }
          else {
            var options = {
              'data': data,
              'user': currentUser,
              'friend': friend,
              'isMe': isMe,
              'myEndpoint': getPOVEndpoint(friend, currentUser)
            };

            renderFile('/components/rendered-friends.pug', options, req, function (err, html) {
              if (err) {
                return next(err);
              }
              return res.send(encryptIfFriend(friend, html));
            });
          }
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
    var highwater = req.query.highwater;
    var tags = req.query.tags;
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
        getPosts(user, friend, highwater, isMe, tags, function (err, posts) {
          cb(err, user, posts);
        });
      },
      function (user, posts, cb) {
        resolvePostPhotos(posts, function (err) {
          cb(err, user, posts);
        });
      },
      function (user, posts, cb) {
        resolveReactionsCommentsAndProfiles(posts, isMe, function (err) {
          cb(err, user, posts);
        });
      }
    ], function (err, user, posts) {
      if (err) {
        return next(err);
      }

      var data = {
        'pov': {
          'user': user.username,
          'isMe': isMe,
          'friend': friend ? friend.remoteUsername : false,
          'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
        },
        'profile': getProfile(user),
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
        'myEndpoint': getPOVEndpoint(friend, currentUser)
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
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');
    var isMe = false;
    var isProxy = req.headers['proxy'];

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
        resolveReactionsCommentsAndProfiles([post], isMe, function (err) {
          cb(err, user, post);
        });
      }
    ], function (err, user, post) {
      if (err) {
        return next(err);
      }

      var data = {
        'pov': {
          'user': user.username,
          'isMe': isMe,
          'friend': friend ? friend.remoteUsername : false,
          'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
        },
        'profile': getProfile(user),
        'post': post
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'isPermalink': req.query.embed ? false : true,
        'isMe': isMe,
        'myEndpoint': getPOVEndpoint(friend, currentUser)
      };

      renderFile('/components/rendered-post.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postReactionsRE, getCurrentUser(), checkNeedProxyRewrite('reactions'), getFriendAccess(), function (req, res, next) {
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
        'pov': {
          'user': user.username,
          'isMe': isMe,
          'friend': friend ? friend.remoteUsername : false,
          'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
        },
        'post': post,
        'reactions': post.resolvedReactions ? post.resolvedReactions : [],
        'reactionSummary': post.reactionSummary,
        'poster': post.resolvedProfiles[post.source].profile,
        'about': post.source + '/post/' + post.uuid
      };

      delete data.post.resolvedReactions;
      delete data.post.reactionSummary;

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'myEndpoint': getPOVEndpoint(friend, currentUser)
      };

      renderFile('/components/rendered-reactions.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postCommentsRE, getCurrentUser(), checkNeedProxyRewrite('comments'), getFriendAccess(), function (req, res, next) {
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
        resolveComments([post], 'post', isMe, function (err) {
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
        'pov': {
          'user': user.username,
          'isMe': isMe,
          'friend': friend ? friend.remoteUsername : false,
          'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
        },
        'post': post,
        'comments': post.resolvedComments ? post.resolvedComments : [],
        'commentSummary': post.commentSummary,
        'commentCount': post.resolvedComments.length,
        'about': post.source + '/post/' + post.uuid
      };

      delete data.post.resolvedComments;
      delete data.post.commentSummary;

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend
      };

      renderFile('/components/rendered-comments.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postCommentRE, getCurrentUser(), checkNeedProxyRewrite('comment'), getFriendAccess(), function (req, res, next) {
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
        resolveComments([post], 'post', isMe, function (err) {
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
          'pov': {
            'user': user.username,
            'isMe': isMe,
            'friend': friend ? friend.remoteUsername : false,
            'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
          },
          'post': {
            'source': post.source,
            'uuid': post.uuid
          },
          'comment': theComment,
          'commentSummary': post.commentSummary,
          'commentCount': post.resolvedComments.length
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        var options = {
          'data': data,
          'user': currentUser,
          'friend': friend,
          'wantSummary': true
        };

        renderFile('/components/rendered-comment.pug', options, req, function (err, html) {
          if (err) {
            return next(err);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postCommentReactionsRE, getCurrentUser(), checkNeedProxyRewrite('reactions'), getFriendAccess(), function (req, res, next) {
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
        resolveComments([post], 'post', isMe, function (err) {
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
          'pov': {
            'user': user.username,
            'isMe': isMe,
            'friend': friend ? friend.remoteUsername : false,
            'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
          },
          'post': post,
          'comment': theComment,
          'reactions': theComment.resolvedReactions ? theComment.resolvedReactions : [],
          'reactionSummary': theComment.reactionSummary,
          'about': theComment.about + '/comment/' + theComment.uuid
        };

        delete data.post.resolvedComments;
        delete theComment.resolvedReactions;
        delete theComment.reactionSummary;

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        var options = {
          'data': data,
          'user': currentUser,
          'friend': friend
        };

        renderFile('/components/rendered-reactions.pug', options, req, function (err, html) {
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
        'pov': {
          'user': user.username,
          'isMe': isMe,
          'friend': friend ? friend.remoteUsername : false,
          'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
        },
        'post': post,
        'photos': post.sortedPhotos ? post.sortedPhotos : []
      };

      delete data.post.sortedPhotos;

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend
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
        'pov': {
          'user': user.username,
          'isMe': isMe,
          'friend': friend ? friend.remoteUsername : false,
          'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
        },
        'photo': thePhoto
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend
      };

      renderFile('/components/rendered-post-photo.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
      });
    });
  });

  router.get(postPhotoReactionsRE, getCurrentUser(), checkNeedProxyRewrite('reactions'), getFriendAccess(), function (req, res, next) {
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

      // TODO kludge
      thePhoto.about = post.source + '/post/' + post.uuid;
      resolveReactions([thePhoto], 'photo', function (err) {

        var data = {
          'pov': {
            'user': user.username,
            'isMe': isMe,
            'friend': friend ? friend.remoteUsername : false,
            'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
          },
          'post': post,
          'photo': thePhoto,
          'reactionSummary': thePhoto.reactionSummary,
          'reactions': thePhoto.resolvedReactions,
          'about': post.source + '/post/' + post.uuid + '/photo/' + thePhoto.uuid
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        var options = {
          'data': data,
          'user': currentUser,
          'friend': friend
        };

        renderFile('/components/rendered-reactions.pug', options, req, function (err, html) {
          if (err) {
            return next(err);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(postPhotoCommentsRE, getCurrentUser(), checkNeedProxyRewrite('comments'), getFriendAccess(), function (req, res, next) {
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

      // TODO kludge
      thePhoto.about = post.source + '/post/' + post.uuid;
      resolveComments([thePhoto], 'photo', isMe, function (err) {
        async.map(thePhoto.resolvedComments, resolveProfiles, function (err) {

          var data = {
            'pov': {
              'user': user.username,
              'isMe': isMe,
              'friend': friend ? friend.remoteUsername : false,
              'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
            },
            'post': post,
            'photo': thePhoto,
            'comments': thePhoto.resolvedComments,
            'about': post.source + '/post/' + post.uuid + '/photo/' + thePhoto.uuid
          };

          if (view === '.json') {
            return res.send(encryptIfFriend(friend, data));
          }

          var options = {
            'data': data,
            'user': currentUser,
            'friend': friend
          };

          renderFile('/components/rendered-comments.pug', options, req, function (err, html) {
            if (err) {
              return next(err);
            }
            return res.send(encryptIfFriend(friend, html));
          });
        });
      });

    });
  });

  router.get(postPhotoCommentRE, getCurrentUser(), checkNeedProxyRewrite('comment'), getFriendAccess(), function (req, res, next) {
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
      resolveComments([thePhoto], 'photo', isMe, function (err) {

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

        async.map([theComment], resolveProfiles, function (err) {

          var data = {
            'pov': {
              'user': user.username,
              'isMe': isMe,
              'friend': friend ? friend.remoteUsername : false,
              'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
            },
            'post': {
              'source': post.source,
              'uuid': post.uuid
            },
            'comment': theComment,
            'commentSummary': thePhoto.commentSummary,
            'commentCount': thePhoto.resolvedComments.length
          };

          if (view === '.json') {
            return res.send(encryptIfFriend(friend, data));
          }

          var options = {
            'data': data,
            'user': currentUser,
            'friend': friend,
            'wantSummary': true
          };

          renderFile('/components/rendered-comment.pug', options, req, function (err, html) {
            if (err) {
              return next(err);
            }
            return res.send(encryptIfFriend(friend, html));
          });
        });
      });
    });
  });

  router.get(postPhotoCommentReactionsRE, getCurrentUser(), checkNeedProxyRewrite('reactions'), getFriendAccess(), function (req, res, next) {
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
      resolveComments([thePhoto], 'photo', isMe, function (err) {

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
          'pov': {
            'user': user.username,
            'isMe': isMe,
            'friend': friend ? friend.remoteUsername : false,
            'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
          },
          'reactionSummary': theComment.reactionSummary,
          'reactions': theComment.resolvedReactions,
          'about': post.source + '/post/' + post.uuid + '/photo/' + thePhoto.uuid + '/comment/' + theComment.uuid
        };

        if (view === '.json') {
          return res.send(encryptIfFriend(friend, data));
        }

        var options = {
          'data': data,
          'user': currentUser,
          'friend': friend
        };

        renderFile('/components/rendered-reactions.pug', options, req, function (err, html) {
          if (err) {
            return next(err);
          }
          return res.send(encryptIfFriend(friend, html));
        });
      });
    });
  });

  router.get(photoRE, getCurrentUser(), checkNeedProxyRewrite('photo'), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var redirectProxy = ctx.get('redirectProxy');
    if (redirectProxy) {
      return next();
    }
    var matches = req.url.match(photoRE);
    var username = matches[1];
    var photoId = matches[2];
    var view = matches[3];
    var friend;
    var currentUser;
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
        getPhoto(photoId, user, friend, function (err, photo) {
          if (err) {
            return cb(err);
          }
          cb(err, user, photo);
        });
      }
    ], function (err, user, photo) {
      if (err) {
        return next(err);
      }

      var data = {
        'pov': {
          'user': user.username,
          'isMe': isMe,
          'friend': friend ? friend.remoteUsername : false,
          'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
        },
        'profile': getProfile(user),
        'photo': photo
      };

      if (view === '.json') {
        return res.send(encryptIfFriend(friend, data));
      }

      var options = {
        'data': data,
        'user': currentUser,
        'friend': friend,
        'isMe': isMe,
        'myEndpoint': getPOVEndpoint(friend, currentUser)
      };

      renderFile('/components/rendered-photo.pug', options, req, function (err, html) {
        if (err) {
          return next(err);
        }
        return res.send(encryptIfFriend(friend, html));
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

  function getProfile(user) {
    return {
      'name': user.name,
      'photo': {
        'url': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO).url
      },
      'background': {
        'url': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO).url
      },
      'backgroundSmall': {
        'url': server.locals.getUploadForProperty('background', user.uploads(), 'thumb', server.locals.FPO).url
      },
      'endpoint': server.locals.config.publicHost + '/' + user.username,
      'publicHost': server.locals.config.publicHost
    };
  }

  function getPosts(user, friend, highwater, isMe, tags, cb) {

    var query = {
      'where': {
        'and': [{
          'userId': user.id
        }]
      },
      'order': 'createdOn DESC',
      'limit': 30
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

    if (tags) {
      try {
        tags = JSON.parse(tags);
      }
      catch (e) {
        tags = [];
      }
      query.where.and.push({
        'tags': {
          'inq': tags
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

  function getPhoto(photoId, user, friend, cb) {
    var query = {
      'where': {
        'and': [{
          'uuid': photoId
        }, {
          'userId': user.id
        }]
      },
      'include': ['uploads']
    };

    debug('getPhoto: %j', query);

    server.models.Photo.findOne(query, function (err, photo) {
      if (err) {
        return cb(err);
      }

      if (!photo) {
        err = new Error('Photo not found');
        err.statusCode = 404;
        return cb(err);
      }

      cb(null, photo);
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

    if (process.env.NODE_ENV === 'production') {
      options.cache = true;
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
