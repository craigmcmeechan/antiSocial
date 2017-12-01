[![CircleCI](https://circleci.com/gh/mediapolis/digitopia-social.svg?style=svg&circle-token=49210d6a4129ef34759580c5288383f49f57528b)](https://circleci.com/gh/mediapolis/digitopia-social)

# AntiSocial

> Architecture & Protocols to implement a widely distributed social network for sharing content.

### Key concepts:

- Users operate their own server (or join a group server cooperative) to host their content in the cloud. There are many economical options for this such as aws, docker, etc. and a design goal is to make that process as turnkey as possible. These servers are "always on" and act as portals for the user to post content and see their friends activity and content.

[Manifesto](https://github.com/antiSocialNet/antiSocial/blob/master/README-manifesto.md)

### Draft Protocol Descriptions
* [Friend Protocol ](https://github.com/antiSocialNet/antiSocial/blob/master/README-FRIEND-PROTOCOL.md)

### Development Notes
* [Build for Development](https://github.com/antiSocialNet/antiSocial/blob/master/README-development.md)

### Primary design goals:

- Total user control and ownership of content
- Total user control over who sees what
- No advertising, no data collection, no demographic information shared with corporations
- Strong cryptography and signed messages for communication between servers that can only be decrypted by the target user
- Decentralized organization comprised of individual servers and server co-op groups
- User experience feels like a single service even though the users are distributed over many servers
- Friend/Follower connections supported across the network
- Instant notification of activity in friend network
- User can move their data from server to server at will w/o disrupting their friend network
- Rich posting tools (styling and layout)
- Package "ready to run" containers using docker for running app major cloud providers
- Expose a control panel on the server to optionally run other useful security services such as VPN, web proxy, dns for the users of the server that want even more control, privacy and security.
