var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var isInitialized = require('../middleware/context-initialized');
var publicUsers = require('../middleware/context-publicUsers');
var pendingFriendRequests = require('../middleware/context-pendingFriendRequests');
var getRecentPosts = require('../middleware/context-getRecentPosts');
var getFriends = require('../middleware/context-getFriends');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var getFriendForEndpoint = require('../middleware/context-getFriendForEndpoint');
var collectFeed = require('../middleware/context-collectFeed');
var resolveProfiles = require('../lib/resolveProfiles');
var resolveReactionsAndComments = require('../lib/resolveReactionsAndComments');
var getPhotosForPosts = require('../lib/resolvePostPhotos');
var nodemailer = require('nodemailer');
var qs = require('querystring');


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

  // get some info about an endpoint
  router.get('/fetch-profile/:endpoint', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var endpoint = req.params.endpoint;

    var item = {
      'about': endpoint
    };
    resolveProfiles(item, function (err) {
      if (err) {
        next(err);
      }
      res.send(item);
    });
  });

  // view a post
  //    /username/post/postid
  //    /username/post/postid.json
  var postRE = /^\/([a-zA-Z0-9\-\.]+)\/post\/([a-f0-9\-]+)(\.json)?$/;
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

      //console.log('finding post %j for friend %j', query, friend);

      req.app.models.Post.findOne(query, function (err, post) {
        if (err) {
          return next(err);
        }

        //console.log('post ', post);

        if (!post) {
          return res.sendStatus(404);
        }

        if (view === '.json') {
          return res.send({
            'profile': {
              'name': user.name,
              'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
              'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
              'endpoint': server.locals.config.publicHost + '/' + user.username
            },
            'post': post
          });
        }

        resolveReactionsAndComments([post], function (err) {
          getPhotosForPosts([post], req.app.models.PostPhoto, function (err) {

            res.render('pages/post', {
              'user': currentUser,
              'globalSettings': ctx.get('globalSettings'),
              'posts': [post],
              'profile': {
                'name': user.name,
                'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
                'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
                'endpoint': server.locals.config.publicHost + '/' + user.username,
                'publicHost': server.locals.config.publicHost
              },
              'isPermalink': true
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
  var profileRE = /^\/([a-zA-Z0-9\-\.]+)(\/profile.json|\/posts.json)?$/;
  router.get(profileRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(profileRE);
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
          resolveReactionsAndComments(posts, function (err) {
            getPhotosForPosts(posts, req.app.models.PostPhoto, function (err) {
              return res.send({
                'profile': {
                  'name': user.name,
                  'photo': server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.headshotFPO),
                  'background': server.locals.getUploadForProperty('background', user.uploads(), 'large', server.locals.FPO),
                  'endpoint': server.locals.config.publicHost + '/' + user.username
                },
                'posts': posts
              });
            });
          });
        }
        else {
          resolveReactionsAndComments(posts, function (err) {
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
