1. What is antiSocial?

   *antiSocial* is a Social Network, similar to Facebook, however with fundamental differences. Each user has an account on a _node_ which may have one or many such accounts. Each node is independently operated and each user is in control of his or her own data. Users can friend one another, either on the same node or on others across the Internet. Any content that they post has a set of permissions which determine who can see that content. It can be Public, just your Friends, other customized lists or, just yourself.

2. Who owns antiSocial?

   anitSocial was originally created by Michael Rhodes, a developer in Massachusetts. It is an Open Source project, meaning that developers across the Internet can contribute new features or fix bugs and the code itself for the system is open to examination by all. It is licensed under the MIT Licence which means that it freely available for both commercial and non-commerical use.

3. How do I get an anitSocial account?

   The easiest way is to find an anitSocial node that is accepting new accounts and sign up. All you need is a name - any name, it doesn't have to be your own - a handle, email address (for notifications) and password. You may be asked to pay an mnothly or yearly fee to contribue to the operation of your node. Once signed up you can invite others to join, or your can send friend requests to others that have accounts.

4. How do I find my friends?

   Well since anitSocial has no central control, there is no central directory of accounts. While the architecture of the system makes that possible, currently a "phone book" where  you can locate your friends on the system doesn't exist. So you will need to contact the people who you want to friend and either have them send you a friend request or give you their "endpoint", which is just short code which uniquely identifies you in the larger antiSocial system. Which that endpoint, you can send them a friend request. Once they accept, the nodes talk to each other and establish a connection. From now on, you will see their content and they will see yours, subject to the permissions that they and you place on the content.

5. What type of content can I post?

   Since each node is independently operated, each one can set its own policies, unlike Facebook, Tumblr, Instagram, Twitter and others which have restrictie policies on nudity, language, and so on. However, *please note that illegal content such as child pornography is illegal regardless of where it is stored and you will still be liable for the content if the authorities discover it.*

6. Where is my data stored?

   Your data is stored on your node, as is the data of ever other user on your node. This is held in a common database but is not visible to each other unless you have granted permission for it to be visible to them, or make it Public in which case it is visible who has access to it, even non-users of the antiSocial network. If your permission allow your friends to see particular pieces of content, then that content is made available for display on their newsfeed. However, your posts are not stored on their nodes, it is always held on yours. The exception to this are comments on posts, which are stored on the node with the original post.

7. Is my data encrypted?

   Each friendship (friend connection) has a unique set of keys shared only by that friendship. Content such as posts, links, photos etc that is sent to your friends is encrypted in transit to each friend individually by each set of unique keys. The basic configuration of antiSocial does *not* encrypt data in a node's database, although some node administrators may choose to do so.

8. What can I post?

   antiSocial supports a richer set of features for posting than most social networks. The editor supports a number of text formatting options such as *bold*, _italics_, headings. You can put multiple links and multiple photographs in one post. You can right-click on any word you type to change the formatting, use [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) which provides a lot of easy ways to do formatting.

   You associate a location with your post by clicking on the location symbol and choosing from the pulldown menu (or just typing in what you want), and you can set a timed post for the future. Click on the calendar icon and set the time in the future that you want the post to be distributed.

9. A friend sent me a link to her post but when I click on the link I can't see it. Why?
   Unlike Facebook which is one monolithic system, antiSocial operates as independent nodes. Since each node is separate, logging in to your account on your node does not log you in on to any other node. Thus if you go to another node directly you will only have the permissions that any member of the public would have to see content on that node. If the content isn't marked "Public" then, in this case you wouldn't be able to see it.

   For example, say you were to receive a link (a URL) in email from @Binky to her post as he sees it. Now you click on that link an it takes you to @Binky's node. However since you are not logged into @Binky's node you may not be able to see it, for example if it was only limited to Friends. "But I *am* her friend!" you passionately exclaim. Yes, you are, but the only way for you to prove that is to log into your own server and access his content through your unique friendship connection. The system can verify that you are who you say you are, but only through your own account.
