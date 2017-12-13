### Facebook bugs me.

It's hard to pin down why, but it just does. __Wait__, *it's not so hard to pin down actually.*

Is it the feature sprawl? Is it the commoditization and commercialization of our personal lives? Is it the corporate control and exploitation of our musings? Is it the censorship of language and images that shoehorns the entire world into a conservative North American sense of propriety? Is it cousin what's his name and his daily posting of LOL cats?

Ultimately I think what bothers me most is this; __even though we use this for very personal purposes, its purpose is anything but personal.__ It's not really a community. It's a machine that funnels us into demographic groups for the purpose of making us a into a lucrative commodity. All the edges are rounded off and everything looks the same. **Ultimately we are here to provide free content to an ad network.**

As a result, for me this social network thing has become dull and mostly a habit. This is not to say that I don't think that having a place to share things and talk to acquaintances, friends and communities is not important. __I just think that facebook gives the illusion of doing those things while actually doing something completely different.__

So.... we've decided to see if we can make something that would be a more social, social network.

> tl;dr We are making a social network where what you post is yours.

- No advertising, no data collection, no demographic information shared with anyone
- Distributed user centered architecture
- Social network made up of many servers operated by individuals and organizations
- Total user control and ownership of content
- Total user control over who sees what
- End-to-end strong cryptography and signed messages for communication between servers that can only be decrypted by the target user
- Friend/Follower connections supported across the network
- User can move their data from server to server at will w/o disrupting their friend network
- Instant notification of activity in friend network just like a centralized service
- More expressive posts: typography, imagery, multiple links

We're building a proof of concept that implements a model of a distributed social network that is designed for secure end-to-end individual control.

The central idea is that any user or group of users can operate their own cheap tiny server running in the cloud which implements the antisocial protocols. This process will be as turnkey as possible (using docker, lightsail or other pushbutton cloud services it is mostly a matter of selecting a provider and launching the predefined service template) but if this is too daunting for some, multiple users can share a server as a cooperative - non-technical users can enlist a technical friend to operate a node for their non-nerds friends or join an open community server. That server is your gateway into your antisocial network.

Server cooperatives could evolve into large communities but the ideal is to keep the number of users per server low mainly because large concentrations will just be replicating the current ecosystem and will inevitably lead to the slippery slope of loss of individual control, "monetization" and "community guidelines" that got us here in the first place.

Once users have a foothold in the cloud, they can "friend" each other just like any other social media platform and subscribe to an aggregated feed of their friends postings. __The difference is that your postings reside on your account on your server and are entirely under your control.__ No data is given to anyone behind the scenes. Your data can be downloaded and relocated to another server at any time while maintaining all your friend connections. You post what you want and only you are responsible for it.

We will be publishing drafts of the protocols we are working on for establishing distributed friend networks and pushing realtime feeds across the network. This is a proof-of-concept prototype implementation of those protocols, not a real service. It will be very spare and probably somewhat broken at times as the idea is to test protocols then build out features, but it already sort of works. A fully functional system for this will be a very large project which will be an open source effort assuming it gets any traction. Once the protocols are final it will need a very capable native clients on iOS, Android all of which will take time and a lot of effort.

So - if are you interested in playing around with this kind of thing let me know.
