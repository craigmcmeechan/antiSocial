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
var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var resolvePostPhotos = require('../lib/resolvePostPhotos');

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


  // public feed
  router.get('/', isInitialized(), getCurrentUser(), publicUsers(), function (req, res, next) {
    var ctx = req.myContext;
    if (!ctx.get('nodeIsInitialized')) {
      res.set('x-digitopia-hijax-flash-level', 'error');
      res.set('x-digitopia-hijax-flash-message', 'need to setup node');
      if (req.headers['x-digitopia-hijax']) {
        return res.set('x-digitopia-hijax-location', '/setup').send('redirect to ' + '/setup');
      }
      res.redirect('/setup');
    }
    else {
      req.app.models.Post.find({
        'where': {
          'visibility': {
            'inq': ['public']
          }
        },
        'order': 'createdOn DESC',
        'limit': 30,
        'include': [{
          'user': ['uploads']
        }, {
          'photos': ['uploads']
        }]
      }, function (err, posts) {
        if (err) {
          return next(err);
        }

        resolveProfilesForPosts(posts, function (err) {
          resolvePostPhotos(posts, function (err) {
            res.render('pages/home', {
              'user': ctx.get('currentUser'),
              'globalSettings': ctx.get('globalSettings'),
              'publicUsers': ctx.get('publicUsers'),
              'posts': posts,
              'passwordResetToken': req.query.access_token
            });
          });
        });
      });
    }
  });

  server.use(router);
};
