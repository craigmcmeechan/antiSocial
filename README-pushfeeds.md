### Eventsource Feeds

Events are propagated through the friend network using [EventSource](https://www.w3schools.com/html/html5_serversentevents.asp). The framework this prototype is built on, [Loopback](https://loopback.io/doc/en/lb3/Realtime-server-sent-events.html), has built in support for subscribing to 'ChangeStreams' on the REST API the framework mounts for data models (tables) all watchers can see any changes to the tables in real-time.

The news feeds are authenticated using the accessTokens that were exchanged in the friending protocol and all content is encrypted and signed using [hybrid public key cryptography](https://en.wikipedia.org/wiki/Hybrid_cryptosystem).

There are 2 Data models we use for this purpose:

#### PushNewsFeedItem
PushNewsFeedItem is the server to server pipeline for propagating events. The originator of an event creates a row in this table when others might want to know about something the user did such as creating a post or reacting to a friend's post.

Eg.
* "Michael created a new post"
* "Michael liked a post"

PushNewsFeedItem feeds are filtered by 'audience'
* Michael's friend Alan has been granted access to ['public','friends','family']
* All posts have a setting to indicate which audiences are allowed to see them. A post marked with audience "family" would be seen by all Friend connections that are members of the "family" audience

#### NewsFeedItem
Watched by the users web browsers. Servers watching for `PushNewsFeedItem` updates create `NewsFeedItem` rows when they see items that would be of interest to the user so that the UI can update the activity feed in real-time.

Eg.
* "Michael created a new post"
* "Michael liked a post by me"
* "Michael liked a post by one of my friends"

The listeners (both the servers and the clients) maintain "high water" pointers so they can pick up where they left off after being offline.

Michael makes a post then allocates a PushNewsFeedItem
```
{
	'type': 'post',
	'source': http://rhodes.com/mr
	'about': http://rhodes.com/mr/post/xxxxxxxxxxxx
	'visibility': ['friends','family']
}
```

Alan's server immediately sees the PushNewsFeedItem because he is in the audience 'family'. Alan's server creates a NewsFeedItem record to propagate this event to his browser
```
{
	'type': 'post',
	'source': http://rhodes.com/mr
	'about': http://rhodes.com/mr/post/xxxxxxxxxxxx
}
```

Alan's web browser immediately sees this and prepends it to his Activity Feed.

Alan reacts to Michael's post by allocating a PushNewsFeedItem
```
{
	'type': 'react',
	'source': http://emtage.com/alan
	'about': http://rhodes.com/mr/post/xxxxxxxxxxxx
	'details': {
		"reaction": "thumbsup"
	}
}
```

Michael's server  immediately sees the PushNewsFeedItem and creates a NewsFeedItem to notify him. In this case the server also creates a 'Reaction' row to accumulate all the 'Likes' for his post

### Prototype Implementation
[Start Listeners on boot](https://github.com/antiSocialNet/antiSocial/blob/master/server/boot/watchNewsFeeds.js)

[PushNewsFeedItem Agent](https://github.com/antiSocialNet/antiSocial/blob/master/server/lib/watchFeed.js)

[NewsFeedItem definition](https://github.com/antiSocialNet/antiSocial/blob/master/common/models/news-feed.json)

[NewsFeedItem methods](https://github.com/antiSocialNet/antiSocial/blob/master/common/models/news-feed.js)

[PushNewsFeedItem definition](https://github.com/antiSocialNet/antiSocial/blob/master/common/models/push-news-feed-item.json)

[PushNewsFeedItem methods](https://github.com/antiSocialNet/antiSocial/blob/master/common/models/push-news-feed-item.js)


```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

GET --------------------->
http://rhodes.com/api/NewsFeedItems/me/live

                                                    <---------------------- GET
                                                                            http://emtage.com/api/NewsFeedItems/me/live

                          GET --------------------->
                          http://emtage.com/api/PushNewsFeedItems/alan/stream-updates
                          HEADERS: {
                            'friend-access-token': Michael's Access token for Alan,
                            'friend-high-water': Latest record seen
                          }

                          <------------------------ GET
                                                    http://rhodes.com/api/PushNewsFeedItems/michael/stream-updates
                                                    HEADERS: {
                                                      'friend-access-token': Alan's Access token for Michael,
                                                      'friend-high-water': Latest record seen
                                                    }
```
