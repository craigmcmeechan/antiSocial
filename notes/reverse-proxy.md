### It's really just a Reverse Proxy

This architecture makes extensive use of a Transparent Reverse Proxy scheme where a user's AntiSocial server retrieves information about their friends and their friends activity via API requests to their friends servers. The API enforces permissions and implements an encryption layer using the keys and tokens exchanged in the [Friend Protocol ](https://github.com/antiSocialNet/antiSocial/blob/master/notes/friends.md).

The UI templates construct links in the appropriate form so all of this is transparent to the user.

> TL;DR Michael's browser requests all information about Alan via a reverse proxy on Michael's server. Michael and Alan's servers work out the permissions for the information being requested.

Implementation:
- [boot/routes-z-endpoints.js](https://github.com/antiSocialNet/antiSocial/blob/master/server/boot/routes-z-endpoints.js)

- [middleware/rewriteUrls.js](https://github.com/antiSocialNet/antiSocial/blob/master/server/middleware/rewriteUrls.js)

- [boot/routes-zz-proxy.js](https://github.com/antiSocialNet/antiSocial/blob/master/server/boot/routes-zz-proxy.js)

Permissions:
* The logged in owner of the account sees all their information
* Friends see information information granted to them by the owner of the information. The request to the endpoint includes the header `friend-access-token` which Alan's server uses to determine what information will be delivered.
* anonymous users see only information marked as 'public'


#### Example request
```
http://rhodes.com/ae/post/xxxxxx
```

Michael's server looks for 'ae' in his friends and if found the request is re-written using  Friend instance to the proxied form of the request:

http://rhodes.com/proxy-post?endpoint=http://emtage.com/ae/post/xxxx

The proxied url form is mostly used internally and is not generally exposed to the client.

Michael's server requests a JSON feed of the allowed information from Alan's server via a user to user encrypted connection.

http://emtage.com/ae/post/xxxx.json w/http header `friend-access-token`

Alan's server delivers the allowed data as a json feed encrypted using keys exchanged with Michael.

Michael's server decrypts the feed, renders the html and delivers the page to the client.

The full API consists of several URL forms. In all cases the first parameter in the url is the username. Subsequent parameters are the unique ids of the information being requested. HTML is delivered by default, JSON is delivered when .json is appended the URL.

```
http://rhodes.com/<username>
http://rhodes.com/<username>/posts
http://rhodes.com/<username>/photo/<id of photo>
http://rhodes.com/<username>/post/<id of post>
http://rhodes.com/<username>/post/<id of post>/reactions
http://rhodes.com/<username>/post/<id of post>/comments
http://rhodes.com/<username>/post/<id of post>/comment/<id of comment>
http://rhodes.com/<username>/post/<id of post>/comment/<id of comment>/reactions
http://rhodes.com/<username>/post/<id of post>/photos
http://rhodes.com/<username>/post/<id of post>/photo/<id of photo>
http://rhodes.com/<username>/post/<id of post>/photo/<id of photo>/reactions
http://rhodes.com/<username>/post/<id of post>/photo/<id of photo>/comments
http://rhodes.com/<username>/post/<id of post>/photo/<id of photo>/comment/<id of comment>
http://rhodes.com/<username>/post/<id of post>/photo/<id of photo>/comment/<id of comment>/reactions
```
