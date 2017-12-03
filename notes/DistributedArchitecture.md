### Distributed architecture

Monolithic, centralized services are the root cause of many social networking ills. Large services are expensive to operate leading to the need for sponsorship to cover costs. Sponsorship comes with a need to maintain "brand integrity" which leads to limiting expression through community guidelines which is the slippery slope we are at the bottom of today.

I think that model can be inverted to the benefit of users by changing the architecture to be distributed instead of monolithic the users then have direct control and responsibility over what they post.

One of the goals of this prototype is to achieve more user control through a secure, distributed architecture while at the same time keeping the immediacy of real-time news feeds that users of social networks have come to expect.

> Eg. When a friend of mine makes a post or likes one of my posts I get an immediate notification on my screen.

A description of the friending protocol can be found [here](https://github.com/antiSocialNet/antiSocial/blob/master/README-friends.md). At the end of this protocol both users will have a Friend record holding the accessToken and the public key of the friend. With these credentials they can exchange signed encrypted messages for notifying each other of activity in their accounts.

Once friend connections are established the anti social network can push events in real time through [secure, encrypted channels](https://github.com/antiSocialNet/antiSocial/blob/master/README-pushfeeds.md) which give the same immediacy as a monolithic, centralized service.

It can also show you pretty pictures...
