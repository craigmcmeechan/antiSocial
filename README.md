
<img src="https://raw.githubusercontent.com/antiSocialNet/antiSocial/master/assets/octocloud/logo.svg" height="200">



[![CircleCI](https://circleci.com/gh/mediapolis/digitopia-social.svg?style=svg&circle-token=49210d6a4129ef34759580c5288383f49f57528b)](https://circleci.com/gh/mediapolis/digitopia-social)

# myAntiSocial.net

> Architecture & Protocols to implement a prototype of a widely distributed social network for sharing content.

### Key concepts:

- Users join an existing server cooperative or operate their own server to host their content in the cloud. There are many economical options for this such as AWS, docker, etc. and a design goal is to make that process as turnkey as possible. These servers are "always on" and act as portals for the user to post content and see their friends activity and content.

### The antisocial guidelines for the ethical treatment of data:
When you make a post it’s yours. It lives on your server. The content of the post is your responsibility. People can only read it if you give them permission. That permission can be revoked at any time. If you want to delete it you can do so at will.

When you comment on someone else’s post that is considered correspondence in that you have ceded shared ownership of that comment to the owner of the original post and are giving some control over that comment to the original post’s owner. A copy of the comment lives on the original post’s server.

### Client side code of ethics:
No trackers such as analytics or ad networks will be embedded in pages unless absolutely necessary to support core features (google maps for geocoding for example). All connections to 3rd party servers will be disclosed to the users preferably with opt out permissions available to users.

### Server code of ethics:
All client connections to the server must be in encrypted. The channels by which servers read content from network must be user to user encrypted with keys exchanged for that relationship. When the server retrieves and decrypts a post from another user it must never be stored locally but immediately delivered only to the logged in user requesting it.

If a user wants to move their account to another server they can do so at will and the system will provide them will all data and preserve their friend connections.

Backups must be encrypted and short lived. All redundant snapshots of user data will be promptly destroyed. The server operator will notify the affected users and their friends of any data event such as a data loss, data restore or a breach.

Servers may not transmit any content or information about resident users or their friends to anyone except where explicitly given permission.

Because servers are subject to the acceptable use policies of the upstream service providers these policies as they impact the users of the server will be publicly posted and transparently enforced. All logging practices will be disclosed to users.

Servers should be directly supported by users, not by advertising networks or information brokering activities.

### Notes

[A Manifesto or sorts](https://github.com/antiSocialNet/antiSocial/blob/master/notes/manifesto.md)

[Building this repo for Development](https://github.com/antiSocialNet/antiSocial/blob/master/notes/development.md)

### Draft Protocol Descriptions
* [Friend Protocol ](https://github.com/antiSocialNet/antiSocial/blob/master/notes/friends.md)
* [Realtime Newsfeeds](https://github.com/antiSocialNet/antiSocial/blob/master/notes/pushfeeds.md)
* [Endpoints and proxies](https://github.com/antiSocialNet/antiSocial/blob/master/notes/reverse-proxy.md)
