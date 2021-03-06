## Members

<dl>
<dt><a href="#GET Comment Form">GET Comment Form</a></dt>
<dd><p>comment form</p>
</dd>
<dt><a href="#POST Create a new comment">POST Create a new comment</a></dt>
<dd><p>create a new comment</p>
</dd>
<dt><a href="#GET Get a comment">GET Get a comment</a></dt>
<dd><p>Get a comment</p>
</dd>
<dt><a href="#POST Post a comment">POST Post a comment</a></dt>
<dd><p>Post a comment</p>
</dd>
<dt><a href="#Get get a post for edit">Get get a post for edit</a></dt>
<dd><p>get a post for edit</p>
</dd>
<dt><a href="#POST Edit a post">POST Edit a post</a></dt>
<dd><p>Edit a post</p>
</dd>
<dt><a href="#Get Edit a post">Get Edit a post</a></dt>
<dd><p>Delete a post</p>
</dd>
<dt><a href="#POST Edit a post">POST Edit a post</a></dt>
<dd><p>Create a post</p>
</dd>
<dt><a href="#Get user profile as JSON object or as an HTML page including posts">Get user profile as JSON object or as an HTML page including posts</a></dt>
<dd><p>Retrieve a user profile as HTML or JSON
The profile being requested could be a user on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include posts the user has made, either public or, if the
requestor is a friend, posts based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get users photos as JSON object or as an HTML page">Get users photos as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve a user&#39;s photos as HTML or JSON
The photos being requested could be of a user&#39;s on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s photos either public or, if the
requestor is a friend, photos based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get users photos as JSON object or as an HTML page">Get users photos as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve a list of a user&#39;s friends as HTML or JSON
The friends being requested could be of a user&#39;s on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s photos either public or, if the
requestor is a friend, photos based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get users posts as JSON object or as an HTML page">Get users posts as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve a user&#39;s posts as HTML or JSON
The posts being requested could be of a user&#39;s on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s posts either public or, if the
requestor is a friend, posts based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get users individual post as JSON object or as an HTML page">Get users individual post as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve an individual post for a user as HTML or JSON
The post being requested could be of a user&#39;s on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response will include the user&#39;s post either public or, if the
requestor is a friend, the post based on the visibility allowed for the
requestor. Otherwise a 404 error is returned</p>
</dd>
<dt><a href="#Get reactions to a users posts as JSON object or as an HTML page">Get reactions to a users posts as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve the reactions (likes, etc) to a user&#39;s post as HTML or JSON
The reactions being requested could be of a user&#39;s post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s post&#39;s reactions either public or, if the
requestor is a friend, reactions based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get comments for a users post as JSON object or as an HTML page">Get comments for a users post as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve the comments on a user&#39;s post as HTML or JSON
The comments being requested could be of a user&#39;s post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s post&#39;s comments either public or, if the
requestor is a friend, comments based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get a comment for a users posts as JSON object or as an HTML page">Get a comment for a users posts as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve an individual comment on a user&#39;s post as HTML or JSON
The comments being requested could be of a user&#39;s post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s post&#39;s comments either public or, if the
requestor is a friend, comments based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get reactions to a comment for a users post as JSON object or as an HTML page">Get reactions to a comment for a users post as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve the reactions for an individual comment on a user&#39;s post as HTML or JSON
The reaction of the comment being requested could be of a user&#39;s post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s post&#39;s comment&#39;s reactions either public or, if the
requestor is a friend, comment&#39;s reactions based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get photos for a users post as JSON object or as an HTML page">Get photos for a users post as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve the photos for an individual post as HTML or JSON
The photos could be of a user&#39;s post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s post&#39;s photos either public or, if the
requestor is a friend, photos based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get a photo for a users post as JSON object or as an HTML page">Get a photo for a users post as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve an individual photo for an individual post as HTML or JSON
The photo could be of a user&#39;s post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s photo either public or, if the
requestor is a friend, photos based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get reactions to a users posts photo as JSON object or as an HTML page">Get reactions to a users posts photo as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve the reactions (likes, etc) to a user&#39;s photo as HTML or JSON
The reactions being requested could be of a user&#39;s post&#39;s photos on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s post&#39;s photo&#39;s reactions either public or, if the
requestor is a friend, reactions based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get comments for a users posts photo as JSON object or as an HTML page">Get comments for a users posts photo as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve the comments on a user&#39;s photo as HTML or JSON
The comments being requested could be of a user&#39;s photo on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s photo&#39;s comments either public or, if the
requestor is a friend, comments based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get a comment for a users posts photo as JSON object or as an HTML page">Get a comment for a users posts photo as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve an individual comment on a user&#39;s photo as HTML or JSON
The comments being requested could be of a user&#39;s post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s photo&#39;s comments either public or, if the
requestor is a friend, comments based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get reactions to a comment on a users photo as JSON object or as an HTML page">Get reactions to a comment on a users photo as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve the reactions for an individual comment on a photo on user&#39;s post as HTML or JSON
The reaction of the comment being requested could be of a user&#39;s post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user&#39;s post&#39;s comment&#39;s reactions either public or, if the
requestor is a friend, comment&#39;s reactions based on the visibility allowed for the
requestor.</p>
</dd>
<dt><a href="#Get users individual photo as JSON object or as an HTML page">Get users individual photo as JSON object or as an HTML page</a></dt>
<dd><p>Retrieve an individual photo for a user as HTML or JSON
The photo being requested could be of a user&#39;s on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response will include the user&#39;s photo either public or, if the
requestor is a friend, the photo based on the visibility allowed for the
requestor. Otherwise a 404 error is returned</p>
</dd>
</dl>

<a name="GET Comment Form"></a>

## GET Comment Form
comment form

**Kind**: global variable  
**Path**: <code>GET</code> /comment-form  
**Code**: <code>200</code> success  
**Query**: <code>String</code> about endpoint of post commenting on  
**Query**: <code>String</code> replyTo endpoint of comment replying to  
**Response**: <code>String</code> html comment form  
<a name="POST Create a new comment"></a>

## POST Create a new comment
create a new comment

**Kind**: global variable  
**Path**: <code>POST</code> /comment/  
**Auth**: With valid user credentials  
**Code**: <code>200</code> success  
**Code**: <code>404</code> post not found  
**Code**: <code>401</code> unauthorized  
**Body**: <code>String</code> description body of the comment in valid markdown  
**Body**: <code>String</code> about contains the uuid of the post and the username of the post  
**Body**: <code>String</code> photoId id of photo included in comment  
**Response**: <code>Object</code> {String} result.status: 'ok' {Object} 'result.comment':
   }  
<a name="GET Get a comment"></a>

## GET Get a comment
Get a comment

**Kind**: global variable  
**Path**: <code>GET</code> /comment/:id  
**Auth**: With valid user credentials  
**Code**: <code>200</code> success  
**Code**: <code>404</code> post not found  
**Code**: <code>401</code> unauthorized
   }  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | Id of comment being retrieved |

<a name="POST Post a comment"></a>

## POST Post a comment
Post a comment

**Kind**: global variable  
**Path**: <code>POST</code> /comment/:id  
**Auth**: With valid user credentials  
**Code**: <code>200</code> success  
**Code**: <code>404</code> post not found  
**Code**: <code>401</code> unauthorized  
**Body**: <code>String</code> body text of the comment in valid markdown  
**Response**: <code>Object</code> {String} result.status: 'ok' {Object} 'result.comment':
   }  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | Id of comment being retrieved |

<a name="Get get a post for edit"></a>

## Get get a post for edit
get a post for edit

**Kind**: global variable  
**Path**: <code>GET</code> /post/:postid  
**Params**: <code>String</code> postid is a valid post id owned by the logged in user  
**Auth**: With valid user credentials  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server  
**Code**: <code>200</code> success  
**Code**: <code>404</code> post not found  
**Code**: <code>401</code> unauthorized  
**Response**: <code>HTML</code> html form for editing post  
<a name="POST Edit a post"></a>

## POST Edit a post
Edit a post

**Kind**: global variable  
**Path**: <code>POST</code> /post/:postid  
**Auth**: With valid user credentials  
**Params**: <code>String</code> postid is a valid post id owned by the logged in user  
**Code**: <code>200</code> success  
**Code**: <code>404</code> post not found  
**Code**: <code>401</code> unauthorized  
**Body**: <code>String</code> body Body of the post in valid markdown  
**Body**: <code>String</code> geoDescription  
**Body**: <code>Object</code> geoLocation eg. {'type':'point','coordinates':[lng,lat]}  
**Body**: <code>Array</code> visibility Array of strings eg. ['public','friends']  
**Body**: <code>String</code> autopost date in gmt  
**Response**: <code>Object</code> result.status 'ok' or if error result.status has a human readable error message. eg. 'result': {'status': 'ok','flashLevel': 'success','flashMessage': 'saved'}  
<a name="Get Edit a post"></a>

## Get Edit a post
Delete a post

**Kind**: global variable  
**Path**: <code>DELETE</code> /post/:postid  
**Params**: <code>String</code> postid is a valid post id owned by the logged in user  
**Auth**: With valid user credentials  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server  
**Code**: <code>200</code> success  
**Code**: <code>404</code> post not found  
**Code**: <code>401</code> unauthorized  
**Response**: <code>Object</code> result.status: 'ok' or if error result.status has a human readable error message.  
<a name="POST Edit a post"></a>

## POST Edit a post
Create a post

**Kind**: global variable  
**Path**: <code>POST</code> /post/  
**Auth**: With valid user credentials  
**Code**: <code>200</code> success  
**Code**: <code>404</code> post not found  
**Code**: <code>401</code> unauthorized  
**Body**: <code>String</code> body Body of the post in valid markdown  
**Body**: <code>String</code> geoDescription  
**Body**: <code>Object</code> geoLocation eg. {'type':'point','coordinates':[lng,lat]}  
**Body**: <code>Array</code> visibility Array of strings eg. ['public','friends']  
**Body**: <code>String</code> autopost date in gmt  
**Response**: <code>Object</code> result.status: 'ok' 'result.uuid': post.uuid
   }  
<a name="Get user profile as JSON object or as an HTML page including posts"></a>

## Get user profile as JSON object or as an HTML page including posts
Retrieve a user profile as HTML or JSON
The profile being requested could be a user on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include posts the user has made, either public or, if the
requestor is a friend, posts based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Query**: <code>String</code> highwater Used for pagination or infinite scrolling of user posts. highwater is the createdOn timestamp of last post seen. (HTML mode only)  
**Query**: <code>String</code> tags Filter posts by tags. eg. ?tags=["%23randompic"] returns only posts hashtagged with #randompic (HTML mode only)  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Code**: <code>200</code> success  
**Code**: <code>404</code> user not found  
**Response**: <code>JSON\|HTML</code> If .json is requested returns JSON profile object, otherwise HTML  
<a name="Get users photos as JSON object or as an HTML page"></a>

## Get users photos as JSON object or as an HTML page
Retrieve a user's photos as HTML or JSON
The photos being requested could be of a user's on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's photos either public or, if the
requestor is a friend, photos based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/photos[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Query**: <code>String</code> tags Filter photos by tags. eg. ?tags=["%23randompic"] returns only photos hashtagged with #randompic (HTML mode only)  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns an array of photo objects, otherwise HTML  
<a name="Get users photos as JSON object or as an HTML page"></a>

## Get users photos as JSON object or as an HTML page
Retrieve a list of a user's friends as HTML or JSON
The friends being requested could be of a user's on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's photos either public or, if the
requestor is a friend, photos based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Query**: <code>String</code> tags Filter photos by tags. eg. ?tags=["%23randompic"] returns only photos hashtagged with #randompic (HTML mode only)  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON</code> If .json is requested returns a user profile object  
**Response**: <code>HTML</code> If .json not requested return user profile page (which includes several posts)  
<a name="Get users posts as JSON object or as an HTML page"></a>

## Get users posts as JSON object or as an HTML page
Retrieve a user's posts as HTML or JSON
The posts being requested could be of a user's on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's posts either public or, if the
requestor is a friend, posts based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/posts[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Query**: <code>String</code> highwater Used for pagination or infinite scrolling of user posts. highwater is the createdOn timestamp of last post seen. (HTML mode only)  
**Query**: <code>String</code> tags Filter posts by tags. eg. ?tags=["%23randompic"] returns only posts hashtagged with #randompic (HTML mode only)  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns an array of JSON post objects, otherwise HTML  
<a name="Get users individual post as JSON object or as an HTML page"></a>

## Get users individual post as JSON object or as an HTML page
Retrieve an individual post for a user as HTML or JSON
The post being requested could be of a user's on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response will include the user's post either public or, if the
requestor is a friend, the post based on the visibility allowed for the
requestor. Otherwise a 404 error is returned

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of post  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested the post JSON object, otherwise HTML  
<a name="Get reactions to a users posts as JSON object or as an HTML page"></a>

## Get reactions to a users posts as JSON object or as an HTML page
Retrieve the reactions (likes, etc) to a user's post as HTML or JSON
The reactions being requested could be of a user's post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's post's reactions either public or, if the
requestor is a friend, reactions based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId/reactions[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of wanted post  
**Params**: <code>String</code> json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns an array of reaction objects, otherwise HTML  
<a name="Get comments for a users post as JSON object or as an HTML page"></a>

## Get comments for a users post as JSON object or as an HTML page
Retrieve the comments on a user's post as HTML or JSON
The comments being requested could be of a user's post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's post's comments either public or, if the
requestor is a friend, comments based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId/comments[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of wanted post  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns an array of comment objects, otherwise HTML  
<a name="Get a comment for a users posts as JSON object or as an HTML page"></a>

## Get a comment for a users posts as JSON object or as an HTML page
Retrieve an individual comment on a user's post as HTML or JSON
The comments being requested could be of a user's post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's post's comments either public or, if the
requestor is a friend, comments based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId/comment/:commentId[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of wanted post  
**Params**: <code>String</code> commentId Id of wanted comment  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns a JSON comment object, otherwise HTML  
<a name="Get reactions to a comment for a users post as JSON object or as an HTML page"></a>

## Get reactions to a comment for a users post as JSON object or as an HTML page
Retrieve the reactions for an individual comment on a user's post as HTML or JSON
The reaction of the comment being requested could be of a user's post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's post's comment's reactions either public or, if the
requestor is a friend, comment's reactions based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId/comment/commentId/reactions[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of wanted post  
**Params**: <code>String</code> commentId Id of wanted comment  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns an array of JSON reaction objects, otherwise HTML  
<a name="Get photos for a users post as JSON object or as an HTML page"></a>

## Get photos for a users post as JSON object or as an HTML page
Retrieve the photos for an individual post as HTML or JSON
The photos could be of a user's post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's post's photos either public or, if the
requestor is a friend, photos based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId/photos[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of wanted post  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns an array of JSON photo objects, otherwise HTML  
<a name="Get a photo for a users post as JSON object or as an HTML page"></a>

## Get a photo for a users post as JSON object or as an HTML page
Retrieve an individual photo for an individual post as HTML or JSON
The photo could be of a user's post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's photo either public or, if the
requestor is a friend, photos based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId/photo/:photoId[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of wanted post  
**Params**: <code>String</code> photoId Id of wanted post  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns JSON photo object, otherwise HTML  
<a name="Get reactions to a users posts photo as JSON object or as an HTML page"></a>

## Get reactions to a users posts photo as JSON object or as an HTML page
Retrieve the reactions (likes, etc) to a user's photo as HTML or JSON
The reactions being requested could be of a user's post's photos on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's post's photo's reactions either public or, if the
requestor is a friend, reactions based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId/photo/:photoId/reactions[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of wanted post  
**Params**: <code>String</code> photoId Id of wanted post  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns an array of reaction objects, otherwise HTML  
<a name="Get comments for a users posts photo as JSON object or as an HTML page"></a>

## Get comments for a users posts photo as JSON object or as an HTML page
Retrieve the comments on a user's photo as HTML or JSON
The comments being requested could be of a user's photo on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's photo's comments either public or, if the
requestor is a friend, comments based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId/photo/:photoId/comments[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of wanted post  
**Params**: <code>String</code> photoId Id of wanted post  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns an array of comment objects, otherwise HTML  
<a name="Get a comment for a users posts photo as JSON object or as an HTML page"></a>

## Get a comment for a users posts photo as JSON object or as an HTML page
Retrieve an individual comment on a user's photo as HTML or JSON
The comments being requested could be of a user's post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's photo's comments either public or, if the
requestor is a friend, comments based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId/photo/:photoId/comment/:commentId[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of wanted post  
**Params**: <code>String</code> photoId Id of wanted post  
**Params**: <code>String</code> commentId Id of wanted comment  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns a JSON comment object, otherwise HTML  
<a name="Get reactions to a comment on a users photo as JSON object or as an HTML page"></a>

## Get reactions to a comment on a users photo as JSON object or as an HTML page
Retrieve the reactions for an individual comment on a photo on user's post as HTML or JSON
The reaction of the comment being requested could be of a user's post on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response may include the user's post's comment's reactions either public or, if the
requestor is a friend, comment's reactions based on the visibility allowed for the
requestor.

**Kind**: global variable  
**Path**: <code>GET</code> /:username/post/:postId/photo/:photoId/comment/commentId/reactions[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> postId Id of wanted post  
**Params**: <code>String</code> photoId Id of wanted post  
**Params**: <code>String</code> commentId Id of wanted comment  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested returns an array of JSON reaction objects, otherwise HTML  
<a name="Get users individual photo as JSON object or as an HTML page"></a>

## Get users individual photo as JSON object or as an HTML page
Retrieve an individual photo for a user as HTML or JSON
The photo being requested could be of a user's on the server or a
friend of a user on the server. If the request is anonymous, only
public information is returned. If the request is for HTML the
response will include the user's photo either public or, if the
requestor is a friend, the photo based on the visibility allowed for the
requestor. Otherwise a 404 error is returned

**Kind**: global variable  
**Path**: <code>GET</code> /:username/photo/:photoId[.json]  
**Params**: <code>String</code> username Username of user on this server or a friend of the logged in user  
**Params**: <code>String</code> photoId Id of photo  
**Params**: <code>String</code> .json Append the .json suffix for JSON response otherwise HTML is returned  
**Auth**: Anonymous, with valid user credentials or with valid friend credentials  
**Header**: <code>String</code> friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records  
**Header**: <code>Cookie</code> access_token Request made by a logged in user on this server (set when user logges in.)  
**Response**: <code>JSON\|HTML</code> If .json is requested the photo JSON object, otherwise HTML  
