// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var resolvePostPhotos = require('../lib/resolvePostPhotos');
var encryption = require('../lib/encryption');
var getCommunityAccess = require('../middleware/context-getCommunityAccess');

var request = require('request');

var debug = require('debug')('communities');

module.exports = function (server) {
  var router = server.loopback.Router();

  var communitiesRE = /^\/communities(\.json)?$/;

  router.get(communitiesRE, getCurrentUser(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(communitiesRE);
    var view = matches[1];
    var currentUser = ctx.get('currentUser');

    if (currentUser) {
      // List communities user subscribes to
      server.models.Subscription.find({
        'userId': currentUser.id
      }, function (err, subscriptions) {
        res.render('pages/subscriptions', {
          'user': currentUser,
          'globalSettings': ctx.get('globalSettings'),
          'subscriptions': subscriptions,
          'pageTitle': 'Communities'
        });
      });
    }
    else {
      // List communities hosted on this server.
      // Redirect to community if only one
      server.models.Community.find({}, function (err, communities) {
        if (err) {
          next(err);
        }

        if (!communities) {
          return res.sendStatus(404);
        }

        if (communities.length === 1) {
          return res.redirect('/community/' + communities[0].nickname);
        }

        res.render('pages/communities', {
          'user': currentUser,
          'globalSettings': ctx.get('globalSettings'),
          'communities': communities,
          'pageTitle': 'Communities'
        });
      });
    }
  });

  var communityRE = /^\/community\/([a-zA-Z0-9-]+)(\.json)?$/;

  router.get(communityRE, getCurrentUser(), getCommunityAccess(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(communityRE);
    var community = matches[1];
    var view = matches[2];
    var currentUser = ctx.get('currentUser');
    var communityAccess = ctx.get('communityAccess');

    if (currentUser) {
      // logged in - find the subscription, get posts from the remote server
      server.models.Subscription.findOne({
        'where': {
          'userId': currentUser.id,
          'communityName': community
        }
      }, function (err, subscription) {
        if (err || !subscription) {
          return res.sendStatus('404');
        }

        var url = subscription.remoteEndPoint + '.json';
        if (req.query.more) {
          url += '?more=' + req.query.more;
        }
        if (req.query.highwater) {
          url += '?highwater=' + req.query.highwater;
        }

        var highwater = 30;


        var options = {
          'url': url,
          'json': true,
          'headers': [{
            'community-access-token': subscription.remoteAccessToken
          }]
        };

        request.get(options, function (err, response, body) {
          if (err || response.statusCode !== 200) {
            return res.sendStatus(response.statusCode ? response.statusCode : 401);
          }

          var data = body;

          if (subscription && body.sig) {
            debug('got encrypted response');
            var privateKey = subscription.keys.private;
            var publicKey = subscription.remotePublicKey;
            var toDecrypt = body.data;
            var sig = body.sig;
            var pass = body.pass;

            var decrypted = encryption.decrypt(publicKey, privateKey, toDecrypt, pass, sig);
            if (!decrypted.valid) {
              return res.sendStatus('401');
            }
            data = JSON.parse(decrypted.data);
          }

          res.header('x-highwater', highwater);
          res.render('pages/community', {
            'user': ctx.get('currentUser'),
            'globalSettings': ctx.get('globalSettings'),
            'data': data,
            'community': community,
            'pageTitle': 'Community: ' + community.name
          });
        });
      });
    }
    else {
      server.models.Community.findOne({
        'where': {
          'nickname': community
        }
      }, function (err, community) {
        if (err) {
          return next(err);
        }
        if (!community) {
          return res.sendStatus(404);
        }

        var query = {
          'where': {
            'and': [{
              'visibility': {
                'inq': ['community:' + community.nickname]
              },
              'posted': true
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

        var highwater = 30;

        if (req.query.more) {
          if (!req.query.highwater) {
            query.skip = 30; // first load more invocation
          }
          else {
            query.skip = req.query.highwater;
            highwater += 30;
          }
        }

        req.app.models.Post.find(query, function (err, posts) {
          if (err) {
            return next(err);
          }

          resolveProfilesForPosts(posts, function (err) {
            resolvePostPhotos(posts, function (err) {
              res.header('x-highwater', highwater);
              res.render('pages/community', {
                'user': ctx.get('currentUser'),
                'globalSettings': ctx.get('globalSettings'),
                'data': {
                  'posts': posts
                },
                'community': community,
                'pageTitle': 'Community: ' + community.name
              });
            });
          });
        });
      });
    }
  });

  server.use(router);
};
