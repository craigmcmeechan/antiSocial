module.exports = {
  '_meta': {
    'sources': [
      'loopback/common/models',
      'loopback/server/models',
      'digitopia-admin/common/models',
      '../common/models',
      './models'
    ],
    'mixins': [
      'loopback/common/mixins',
      'loopback/server/mixins',
      '../node_modules/loopback-ds-timestamp-mixin',
      '../common/mixins',
      './mixins'
    ]
  },
  'Upload': {
    'dataSource': 'db',
    'public': process.env.ADMIN ? true : false
  },
  'User': {
    'dataSource': 'db',
    'public': false
  },
  'AccessToken': {
    'dataSource': 'db',
    'public': process.env.ADMIN ? true : false
  },
  'ACL': {
    'dataSource': 'db',
    'public': process.env.ADMIN ? true : false
  },
  'RoleMapping': {
    'dataSource': 'db',
    'options': {
      'strictObjectIDCoercion': true,
    },
    'public': process.env.ADMIN ? true : false
  },
  'Role': {
    'dataSource': 'db',
    'public': process.env.ADMIN ? true : false
  },
  'MyUser': {
    'dataSource': 'db',
    'public': true
  },
  'UserIdentity': {
    'dataSource': 'db',
    'public': process.env.ADMIN ? true : false
  },
  'ImageSet': {
    'dataSource': 'db',
    'public': process.env.ADMIN ? true : false
  },
  'Settings': {
    'dataSource': 'db',
    'public': process.env.ADMIN ? true : false
  },
  'OgTag': {
    'dataSource': 'db',
    'public': true
  },
  'Post': {
    'dataSource': 'db',
    'public': true
  },
  'Friend': {
    'dataSource': 'db',
    'public': true
  },
  'PushNewsFeedItem': {
    'dataSource': 'db',
    'public': true
  },
  'NewsFeedItem': {
    'dataSource': 'db',
    'public': true
  },
  'Reaction': {
    'dataSource': 'db',
    'public': true
  },
  'Comment': {
    'dataSource': 'db',
    'public': true
  },
  'Photo': {
    'dataSource': 'db',
    'public': true
  },
  'PostPhoto': {
    'dataSource': 'db',
    'public': true
  },
  'Invitation': {
    'dataSource': 'db',
    'public': true
  },
  'Request': {
    'dataSource': 'db',
    'public': true
  }
};
