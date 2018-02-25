Please join me on myAntiSocial.net

This experimental prototype is an implementation of a "distributed" social network (a social network consisting of many user controlled servers). We have worked out most of the protocols that allow the application to behave like a centralized service.

What is the same as other services:
- Establish friend relationships
- Create posts with explicit audience permission w/ optional photos and geotagging
- Real time updates of new posts, comments and likes in your friend network

What is different:
- News feeds contain only content created by your friends (and friends of friends if one of your friends interacted with that content.)
- No advertising, no data collection, no demographic information shared with anyone
- Total user control and ownership of content
- End-to-end strong cryptography and signed messages for communication between servers that can only be decrypted by the target user
- More expressive posts: typography, imagery, multiple links

This is a work in progress and this particular implementation is mostly aimed at proving protocol theories but it kinda works. At this stage I need some people to use it a bit (make some posts, make some friends and like and comment on stuff)

Expect things to be broken and half implemented. The mobile experience is mostly workable (works best if you save the page to your home screen and use it via that "bookmark" because it does away with the safari/chrome UI which jut gets in the way.)
