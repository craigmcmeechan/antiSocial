### Reverse Proxy

This architecture makes extensive use of a Reverse Proxy scheme where a user's AntiSocial server retrieves information about their friends and their friends activity via API requests to their friends servers. The API enforces permissions and implements an encryption layer using the keys and tokens exchanged in the [Friend Protocol ](https://github.com/antiSocialNet/antiSocial/blob/master/notes/friends.md).

The UI templates construct links in the appropriate form so all of this is transparent to the user.

> TL;DR Michael's browser requests all information about Alan via a reverse proxy on Michael's server. Michael and Alan's servers work out the permissions for the information being requested.

#### Direct requests
The logged in owner of the account sees all their information,
anonymous users see only information marked as 'public'
```
http://rhodes.com/mr
http://rhodes.com/mr/post/xxxxxx
```

#### Proxied requests
Michael can view his friend Alan's timeline using his server as a proxy which
delivers all the information that Alan has allowed Michael to see. The request to the endpoint includes the `friend-access-token` header which Alan's server uses to determine what information will be delivered. (These requests can also deliver JSON if desired when the parameter &format=json is provided.)
```
http://rhodes.com/proxy-profile?endpoint=http://emtage.com/ae
http://rhodes.com/proxy-post?endpoint=http://emtage.com/post/xxxx
```

In this case Michael's server receives a JSON feed of the allowed information from Alan's server via a user to user encrypted connection. Michael's server then renders the html and delivers the page to the client. The full API consists of several URL forms. In all cases the first parameter in the url is the username. Subsequent parameters are the ids of the information being requested. HTML is delivered when the .json is omitted from the URL.

```
http://rhodes.com/mr.json
http://emtage.com/proxy-profile?endpoint=http://rhodes.com/mr

http://rhodes.com/mr/posts.json
http://emtage.com/proxy-posts?endpoint=http://rhodes.com/mr/posts

http://rhodes.com/mr/post/<id of post>.json
http://emtage.com/proxy-post?endpoint=http://rhodes.com/mr/post/<id of post>

http://rhodes.com/mr/post/<id of post>/reactions.json
http://emtage.com/proxy-post-reactions?endpoint=http://rhodes.com/mr/post/<id of post>/reactions

http://rhodes.com/mr/post/<id of post>/comments.json
http://emtage.com/proxy-post-comments?endpoint=http://rhodes.com/mr/post/<id of post>/comments

http://rhodes.com/mr/post/<id of post>/comment/<id of comment>.json
http://emtage.com/proxy-post-comment?endpoint=http://rhodes.com/mr/post/<id of post>/comment/<id of comment>

http://rhodes.com/mr/post/<id of post>/comment/<id of comment>/reactions.json
http://emtage.com/proxy-post-comment-reactions?endpoint=http://rhodes.com/mr/post/<id of post>/comment/<id of comment>/reactions

http://rhodes.com/mr/post/<id of post>/photos.json
http://emtage.com/proxy-post-photos?endpoint=http://rhodes.com/mr/post/<id of post>/photos

http://rhodes.com/mr/post/<id of post>/photo/<id of photo>.json
http://emtage.com/proxy-post-photo?endpoint=http://rhodes.com/mr/post/<id of post>/photo/<id of photo>

http://rhodes.com/mr/post/<id of post>/photo/<id of photo>/reactions.json
http://emtage.com/proxy-post-photo-reactions?endpoint=http://rhodes.com/mr/post/<id of post>/photo/<id of photo>/reactions

http://rhodes.com/mr/post/<id of post>/photo/<id of photo>/comments.json
http://emtage.com/proxy-post-photo-comments?endpoint=http://rhodes.com/mr/post/<id of post>/photo/<id of photo>/comments

http://rhodes.com/mr/post/<id of post>/photo/<id of photo>/comment/<id of comment>.json
http://emtage.com/proxy-post-photo-comment?endpoint=http://rhodes.com/mr/post/<id of post>/photo/<id of photo>/comment/<id of comment>

http://rhodes.com/mr/post/<id of post>/photo/<id of photo>/comment/<id of comment>/reactions.json
http://emtage.com/proxy-post-photo-comment-reactions?endpoint=http://rhodes.com/mr/post/<id of post>/photo/<id of photo>/comment/<id of comment>/reactions

```
