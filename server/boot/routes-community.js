// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var resolvePostPhotos = require('../lib/resolvePostPhotos');
var encryption = require('../lib/encryption');
var getCommunityMember = require('../middleware/context-getCommunityMember');
var async = require('async');
var request = require('request');
var utils = require('../lib/endpoint-utils');
var debug = require('debug')('communities');
var VError = require('verror').VError;
var WError = require('verror').WError;

module.exports = function (server) {
  var router = server.loopback.Router();

  var communitiesRE = /^\/communities(\.json)?$/;
  router.get(communitiesRE, getCurrentUser(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(communitiesRE);
    var view = matches[1];
    var currentUser = ctx.get('currentUser');

    // TODO is json view needed?

    async.waterfall([
      function getHostedCommunities(cb) {
        server.models.Community.find({}, function (err, communities) {
          if (err) {
            return cb(err);
          }
          cb(null, communities);
        });
      },
      function getSubscriptions(communities, cb) {
        if (!currentUser) {
          return cb(null, communities, null);
        }
        server.models.Subscription.find({
          'userId': currentUser.id
        }, function (err, subscriptions) {
          cb(err, communities, subscriptions);
        });
      }
    ], function (err, communities, subscriptions) {
      if (subscriptions && subscriptions.length) {
        return res.render('pages/subscriptions', {
          'user': currentUser,
          'globalSettings': ctx.get('globalSettings'),
          'subscriptions': subscriptions,
          'communities': communities,
          'pageTitle': 'Your Communities'
        });
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
        'pageTitle': 'Server Communities'
      });
    });
  });

  var communityRE = /^\/community\/([a-zA-Z0-9-]+)(\.json)?$/;

  router.get(communityRE, getCurrentUser(), getCommunityMember(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(communityRE);
    var community = matches[1];
    var view = matches[2];
    var currentUser = ctx.get('currentUser');
    var communityMember = ctx.get('communityMember');

    async.waterfall([
      function getSubscription(cb) { // find user subscription
        if (!currentUser) {
          return cb(null, null);
        }
        server.models.Subscription.findOne({
          'where': {
            'userId': currentUser.id,
            'communityName': community
          }
        }, function (err, subscription) {
          cb(err, subscription);
        });
      },
      function getCommunity(subscription, cb) {
        if (subscription) {
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
            'headers': {
              'community-access-token': subscription.remoteAccessToken
            }
          };

          request.get(options, function (err, response, body) {
            if (err || response.statusCode !== 200) {
              console.log('got bad response', err);
              if (err) {
                return cb(new VError(err, 'Could not get community feed'));
              }
              else {
                return cb(new VError('Got bad response %s', response.statusCode));
              }
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
                return cb(new VError('unable to decrypt response'));
              }
              data = JSON.parse(decrypted.data);
            }

            data.highwater = highwater;

            cb(null, subscription, data);
          });
        }
        else {
          // is it a local community?
          server.models.Community.findOne({
            'where': {
              'nickname': community
            }
          }, function (err, community) {
            if (err) {
              return cb(err);
            }
            if (!community) {
              var e = new Error('community not found');
              e.httpStatusCode = 404;
              return cb(e);
            }

            if (!communityMember) {
              return cb(err, null, {
                'community': community
              });
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
                return cb(err);
              }

              resolveProfilesForPosts(posts, function (err) {
                resolvePostPhotos(posts, function (err) {
                  cb(err, null, {
                    'community': community,
                    'posts': posts,
                    'highwater': highwater
                  });
                });
              });
            });
          });
        }
      }
    ], function (err, subscription, feed) {
      if (err) {
        return next(err);
      }
      if (view === '.json') {
        return res.send(utils.encryptIfFriend(communityMember, feed));
      }
      res.header('x-highwater', feed.highwater);
      res.render('pages/community', {
        'user': ctx.get('currentUser'),
        'globalSettings': ctx.get('globalSettings'),
        'data': feed,
        'pageTitle': 'Community: ' + feed.community.name,
        'subscription': subscription,
        'member': communityMember
      });
    });
  });

  server.use(router);
};
