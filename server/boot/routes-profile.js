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
var resolveReactionsCommentsAndProfiles = require('../lib/resolveReactionsCommentsAndProfiles');
var resolvePostPhotos = require('../lib/resolvePostPhotos');
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


  // show posts for me or endpoint
  router.get('/profile', getCurrentUser(), getFriendForEndpoint(), function (req, res, next) {
    var ctx = req.myContext;
    var endpoint = req.query.endpoint;
    var currentUser = ctx.get('currentUser');
    var friend = ctx.get('isFriend');

    // check if endpoint is me
    if (currentUser) {
      var myEndPoint = server.locals.config.publicHost + '/' + currentUser.username;
      if (endpoint === myEndPoint) {
        endpoint = null;
      }
    }

    // view other profile (not logged in user)
    if (endpoint) {
      var options = {
        'url': endpoint + '/profileandposts.json',
        'json': true,
        headers: {
          'friend-access-token': friend ? friend.remoteAccessToken : ''
        }
      };
      request.get(options, function (err, response, body) {
        if (err) {
          var e = new VError(err, 'could not load endpoint ' + endpoint);
          return next(e);
        }
        if (response.statusCode !== 200) {
          return res.sendStatus(response.statusCode);
        }

        var data = body;

        if (friend && body.sig) {
          var privateKey = friend.keys.private;
          var publicKey = friend.remotePublicKey;
          var toDecrypt = body.data;
          var sig = body.sig;
          var pass = body.pass;

          var decrypted = encryption.decrypt(publicKey, privateKey, toDecrypt, pass, sig);
          if (!decrypted.valid) { // could not validate signature
            return res.sendStatus('401');
          }

          data = JSON.parse(decrypted.data);
        }

        res.render('pages/profile', {
          'globalSettings': ctx.get('globalSettings'),
          'profile': data.profile,
          'posts': data.posts,
          'isFriend': ctx.get('isFriend'),
          'user': currentUser,
          'wall': true
        });
      });
    }
    else {
      if (!currentUser) {
        res.set('x-digitopia-hijax-flash-level', 'warning');
        res.set('x-digitopia-hijax-flash-message', 'Not Logged In');
        if (req.headers['x-digitopia-hijax']) {
          return res.set('x-digitopia-hijax-location', '/').send('redirect to ' + '/');
        }
        return res.redirect('/');
      }

      req.app.models.Post.find({
        'where': {
          'userId': currentUser.id
        },
        'order': 'createdOn DESC',
        'limit': 30,
        'include': [{
          'user': ['uploads']
        }]
      }, function (err, posts) {
        if (err) {
          return next(err);
        }

        resolveReactionsCommentsAndProfiles(posts, function (err) {
          resolvePostPhotos(posts, function (err) {
            for (var i = 0; i < posts.length; i++) {
              posts[i].counts = {};
              var reactions = posts[i].resolvedReactions;
              var counts = {};
              for (var j = 0; j < reactions.length; j++) {
                if (!posts[i].counts[reactions[j].reaction]) {
                  posts[i].counts[reactions[j].reaction] = 0;
                }
                ++posts[i].counts[reactions[j].reaction];
              }
            }
            res.render('pages/profile', {
              'profile': {
                'name': currentUser.name + ' (me)',
                'photo': server.locals.getUploadForProperty('photo', currentUser.uploads(), 'thumb', server.locals.headshotFPO),
                'background': server.locals.getUploadForProperty('background', currentUser.uploads(), 'large', server.locals.FPO),
                'endpoint': server.locals.config.publicHost + '/' + currentUser.username
              },
              'globalSettings': ctx.get('globalSettings'),
              'posts': posts,
              'user': currentUser,
              'isMe': true
            });
          });
        });
      });
    }
  });



  server.use(router);
};
