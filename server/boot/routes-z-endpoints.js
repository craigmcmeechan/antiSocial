var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var resolveReactionsCommentsAndProfiles = require('../lib/resolveReactionsCommentsAndProfiles');
var getPhotosForPosts = require('../lib/resolvePostPhotos');
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

  var profileRE = /^\/([a-zA-Z0-9\-\.]+)\/profile(\.json)?$/;
  var postsRE = /^\/([a-zA-Z0-9\-\.]+)\/posts(\.json)?$/;
  var postRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)(\.json)?$/;
  var postReactionsRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/reactions(\.json)?$/;
  var postCommentsRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/comments(\.json)?$/;
  var postCommentRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)(\.json)?$/;
  var postCommentReactionsRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)\/reactions(\.json)?$/;
  var postPhotosRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/photos(\.json)?$/;
  var postPhotoRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)(\.json)?$/;
  var postPhotoReactionsRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/reactions(\.json)?$/;
  var postPhotoCommentsRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/comments(\.json)?$/;
  var postPhotoCommentRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/comments\/([a-f0-9\-]+)(\.json)?$/;
  var postPhotoCommentReactionsRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/comments\/([a-f0-9\-]+)\/reactions(\.json)?$/;

  router.get(profileRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(profileRE);
    var username = matches[1];
    var view = matches[2];
    var accessToken = req.headers['friend-access-token'];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    req.app.models.MyUser.findOne({
      'where': {
        'username': username
      },
      'include': ['uploads']
    }, function (err, user) {
      if (err || !user) {
        return res.sendStatus('404');
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
        pug.renderFile(server.get('views') + '/components/rendered-profile.pug', {
          'data': data,
          'user': currentUser,
          'friend': friend
        }, function (err, html) {
          if (err) {
            console.log(err);
            return res.sendStatus(500);
          }
          return res.send(encryptIfFriend(friend, html));
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

    req.app.models.MyUser.findOne({
      'where': {
        'username': username
      },
      'include': ['uploads']
    }, function (err, user) {
      if (err || !user) {
        return res.sendStatus('404');
      }

      var query = {
        'where': {
          'and': [{
            'userId': user.id
          }, {
            'visibility': {
              'inq': friend && friend.audiences ? friend.audiences : ['public']
            }
          }]
        },
        'order': 'createdOn DESC',
        'limit': 10,
        'include': [{
          'user': ['uploads']
        }]
      };

      if (highwater) {
        query.where.and.push({
          'createdOn': {
            'gt': highwater
          }
        });
      }

      debug(req.url + ' %j', query);

      req.app.models.Post.find(query, function (err, posts) {
        if (err) {
          return next(err);
        }

        for (var i = 0; i < posts.length; i++) {
          posts[i].counts = {};
          var reactions = posts[i].resolvedReactions ? posts[i].resolvedReactions : [];
          var counts = {};
          for (var j = 0; j < reactions.length; j++) {
            if (!posts[i].counts[reactions[j].reaction]) {
              posts[i].counts[reactions[j].reaction] = 0;
            }
            ++posts[i].counts[reactions[j].reaction];
          }
        }

        resolveReactionsCommentsAndProfiles(posts, function (err) {
          getPhotosForPosts(posts, req.app.models.PostPhoto, function (err) {
            var data = {
              'posts': posts
            };
            if (view === '.json') {
              return res.send(encryptIfFriend(friend, data));
            }
            else {
              pug.renderFile(server.get('views') + '/components/rendered-posts.pug', {
                'data': data,
                'user': currentUser,
                'friend': friend,
                'moment': server.locals.moment,
                'marked': server.locals.marked
              }, function (err, html) {
                if (err) {
                  console.log(err);
                  return res.sendStatus(500);
                }
                return res.send(encryptIfFriend(friend, html));
              });
            }
          });
        });
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

    req.app.models.MyUser.findOne({
      'where': {
        'username': username
      },
      'include': ['uploads']
    }, function (err, user) {

      if (err || !user) {
        return res.sendStatus('404');
      }

      var query = {
        'where': {
          'and': [{
            'uuid': postId
          }, {
            'userId': user.id
          }, {
            'visibility': {
              'inq': friend && friend.audiences ? friend.audiences : ['public']
            }
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

      debug(req.url + ' %j', query);

      req.app.models.Post.findOne(query, function (err, post) {
        if (err) {
          return next(err);
        }

        if (!post) {
          return res.sendStatus(404);
        }

        resolveReactionsCommentsAndProfiles([post], function (err) {
          getPhotosForPosts([post], req.app.models.PostPhoto, function (err) {

            var data = {
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
              'marked': server.locals.marked
            }, function (err, html) {
              if (err) {
                console.log(err);
                return res.sendStatus(500);
              }
              return res.send(encryptIfFriend(friend, html));
            });
          });
        });
      });
    });
  });

  // view profile && posts filtered by friend access
  //    /username  - html profile page
  //    /username/profile.json - profile as json
  //    /username/posts.json - profile and posts as json (proxied /profile)
  var oldRE = /^\/([a-zA-Z0-9\-\.]+)(\/zposts.json)?$/;
  router.get(oldRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(oldRE);
    var username = matches[1];
    var view = matches[2];
    var accessToken = req.headers['friend-access-token'];
    var highwater = req.headers['friend-high-water'];
    var friend = ctx.get('friendAccess');
    var currentUser = ctx.get('currentUser');

    req.app.models.MyUser.findOne({
      'where': {
        'username': username
      },
      'include': ['uploads']
    }, function (err, user) {
      if (err || !user) {
        return res.sendStatus('404');
      }

      var query = {
        'where': {
          'and': [{
            'userId': user.id
          }, {
            'visibility': {
              'inq': friend && friend.audiences ? friend.audiences : ['public']
            }
          }]
        },
        'order': 'createdOn DESC',
        'limit': 10,
        'include': [{
          'user': ['uploads']
        }]
      };

      if (highwater) {
        query.where.and.push({
          'createdOn': {
            'gt': highwater
          }
        });
      }

      //console.log('query %j', query);

      req.app.models.Post.find(query, function (err, posts) {
        if (err) {
          return next(err);
        }

        for (var i = 0; i < posts.length; i++) {
          posts[i].counts = {};
          var reactions = posts[i].resolvedReactions ? posts[i].resolvedReactions : [];
          var counts = {};
          for (var j = 0; j < reactions.length; j++) {
            if (!posts[i].counts[reactions[j].reaction]) {
              posts[i].counts[reactions[j].reaction] = 0;
            }
            ++posts[i].counts[reactions[j].reaction];
          }
        }

        if (view === '/profile.json') {
          return res.send({
            'profile': {
              'name': user.name,
              'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
              'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
              'endpoint': server.locals.config.publicHost + '/' + user.username,
              'publicHost': server.locals.config.publicHost
            }
          });
        }
        else if (view === '/posts.json') {
          resolveReactionsCommentsAndProfiles(posts, function (err) {
            getPhotosForPosts(posts, req.app.models.PostPhoto, function (err) {
              var response = {
                'profile': {
                  'name': user.name,
                  'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
                  'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
                  'endpoint': server.locals.config.publicHost + '/' + user.username
                },
                'posts': posts
              }
              if (friend) {
                var privateKey = friend.keys.private;
                var publicKey = friend.remotePublicKey;
                var encrypted = encryption.encrypt(publicKey, privateKey, JSON.stringify(response));

                var payload = {
                  'data': encrypted.data,
                  'sig': encrypted.sig,
                  'pass': encrypted.pass
                };
              }
              else {
                payload = response;
              }

              return res.send(payload);
            });
          });
        }
        else {
          resolveReactionsCommentsAndProfiles(posts, function (err) {
            getPhotosForPosts(posts, req.app.models.PostPhoto, function (err) {

              res.render('pages/profile', {
                'user': currentUser,
                'globalSettings': ctx.get('globalSettings'),
                'posts': posts,
                'profile': {
                  'name': user.name,
                  'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
                  'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
                  'endpoint': server.locals.config.publicHost + '/' + user.username,
                  'publicHost': server.locals.config.publicHost
                }
              });
            });
          });
        }
      });
    });
  });

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
