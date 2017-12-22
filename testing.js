function getUserAndPosts
async.waterfall([
	function (cb) {
		getUser(username, function (err, user) {
			if (err) {
				return cb(err);
			}
			cb(err, user);
		});
	},
	function (user, cb) {
		if (currentUser) {
			if (currentUser.id.toString() === user.id.toString()) {
				isMe = true;
			}
		}
		getPosts(user, friend, highwater, isMe, function (err, posts) {
			cb(err, user, posts);
		});
	},
	function (user, posts, cb) {
		resolvePostPhotos(posts, function (err) {
			cb(err, user, posts);
		});
	},
	function (user, posts, cb) {
		resolveReactionsCommentsAndProfiles(posts, function (err) {
			cb(err, user, posts);
		});
	}
], function (err, user, posts) {
	if (err) {
		return next(err);
	}
});


(function ($) {
	function socialButtons(elem, options) {
		this.element = $(elem);
		var self = this;

		this.start = function () {};

		this.stop = function () {};

		this.render = function (chunk) {

			if (FB) {
				FB.XFBML.parse($(chunk)[0]);
			}
			else {
				console.log('facebook not loaded yet?');
			}

			if (twttr) {
				twttr.widgets.load();
			}
			else {
				console.log('twitter not loaded yet?');
			}

		};
	}

	$.fn.socialButtons = GetJQueryPlugin('socialButtons', socialButtons);

})(jQuery);

this.element.on('click', '.social-share-fb', function () {
	FB.ui({
			method: 'share',
			href: $(this).data('href'),
		},
		function (response) {
			if (response && !response.error_code) {
				//alert('Posting completed.');
			}
			else {
				//alert('Error while posting.');
			}
		}
	);
});

(function (d, s, id) {
	var js, fjs = d.getElementsByTagName(s)[0];
	if (d.getElementById(id)) {
		return;
	}
	js = d.createElement(s);
	js.id = id;
	js.src = "//connect.facebook.net/en_US/sdk.js";
	fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));

// facebook API
window.fbAsyncInit = function () {
	FB.init({
		appId: '765213753523438',
		xfbml: true,
		version: 'v2.1'
	});
};



{
	"profile": {
		"name": "User Two",
		"photo": {
			"url": "/images/slug.png"
		},
		"background": {
			"url": "/images/fpo.jpg"
		},
		"endpoint": "http://127.0.0.1:3000/user-2",
		"publicHost": "http://127.0.0.1:3000"
	},
	"post": {
		"uuid": "b9cf60f7-dc41-46ff-8695-9b7795d31784",
		"source": "http://127.0.0.1:3000/user-2",
		"body": "Hello world",
		"visibility": ["friends"],
		"id": 2,
		"userId": 2,
		"createdOn": "2017-12-20T05:44:07.633Z",
		"updatedOn": "2017-12-20T05:44:07.633Z",
		"sortedPhotos": [{
			"status": "complete",
			"title": "photo Title",
			"description": "photo Description",
			"uuid": "db478059-207d-47a6-85c7-b5c93ebf9825",
			"id": 1,
			"userId": 2,
			"createdOn": "2017-12-20T05:44:07.089Z",
			"updatedOn": "2017-12-20T05:44:07.640Z",
			"uploads": [{
				"property": "optimized",
				"type": "JPEG",
				"url": "http://127.0.0.1:3000/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380.jpeg",
				"bucket": "site-uploads",
				"imageSet": {
					"large": {
						"suffix": "large",
						"quality": 90,
						"maxHeight": 2048,
						"maxWidth": 2048,
						"path": "client/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380large.jpeg",
						"width": 3071,
						"height": 2048,
						"url": "http://127.0.0.1:3000/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380large.jpeg"
					},
					"thumb": {
						"suffix": "thumb",
						"quality": 90,
						"maxHeight": 300,
						"maxWidth": 300,
						"path": "client/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380thumb.jpeg",
						"width": 450,
						"height": 300,
						"url": "http://127.0.0.1:3000/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380thumb.jpeg"
					},
					"original": {
						"original": true,
						"width": "1024",
						"height": "683",
						"path": "client/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380.jpeg",
						"url": "http://127.0.0.1:3000/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380.jpeg"
					}
				},
				"id": 1,
				"uploadableId": 1,
				"uploadableType": "Photo",
				"createdOn": "2017-12-20T05:44:07.592Z",
				"updatedOn": "2017-12-20T05:44:07.592Z"
			}]
		}],
		"resolvedComments": [{
			"uuid": "c53a78f3-f4fa-49c9-b415-7bc7ae31017d",
			"type": "comment",
			"source": "http://127.0.0.1:3000/user-1",
			"about": "http://127.0.0.1:3000/user-2/post/b9cf60f7-dc41-46ff-8695-9b7795d31784",
			"details": {
				"body": "a comment"
			},
			"createdOn": "2017-12-20T05:44:07.725Z",
			"updatedOn": "2017-12-20T05:44:07.725Z",
			"originator": false,
			"id": 10,
			"userId": 2,
			"friendId": 2,
			"resolvedReactions": [{
				"uuid": "132a0ddf-81dc-4d5d-be2d-2da1ef51f1a7",
				"type": "react",
				"source": "http://127.0.0.1:3000/user-1",
				"about": "http://127.0.0.1:3000/user-2/post/b9cf60f7-dc41-46ff-8695-9b7795d31784/comment/c53a78f3-f4fa-49c9-b415-7bc7ae31017d",
				"details": {},
				"createdOn": "2017-12-20T05:44:07.767Z",
				"updatedOn": "2017-12-20T05:44:07.767Z",
				"originator": true,
				"id": 11,
				"userId": 1,
				"resolvedProfiles": {
					"http://127.0.0.1:3000/user-1": {
						"status": 200,
						"profile": {
							"name": "User One",
							"photo": {
								"url": "/images/slug.png"
							},
							"background": {
								"url": "/images/fpo.jpg"
							},
							"endpoint": "http://127.0.0.1:3000/user-1",
							"publicHost": "http://127.0.0.1:3000"
						}
					},
					"http://127.0.0.1:3000/user-2/post/b9cf60f7-dc41-46ff-8695-9b7795d31784/comment/c53a78f3-f4fa-49c9-b415-7bc7ae31017d": {
						"status": 200,
						"profile": {
							"name": "User Two",
							"photo": {
								"url": "/images/slug.png"
							},
							"background": {
								"url": "/images/fpo.jpg"
							},
							"endpoint": "http://127.0.0.1:3000/user-2",
							"publicHost": "http://127.0.0.1:3000"
						}
					}
				}
			}],
			"resolvedProfiles": {
				"http://127.0.0.1:3000/user-1": {
					"status": 200,
					"profile": {
						"name": "User One",
						"photo": {
							"url": "/images/slug.png"
						},
						"background": {
							"url": "/images/fpo.jpg"
						},
						"endpoint": "http://127.0.0.1:3000/user-1",
						"publicHost": "http://127.0.0.1:3000"
					}
				},
				"http://127.0.0.1:3000/user-2/post/b9cf60f7-dc41-46ff-8695-9b7795d31784": {
					"status": 200,
					"profile": {
						"name": "User Two",
						"photo": {
							"url": "/images/slug.png"
						},
						"background": {
							"url": "/images/fpo.jpg"
						},
						"endpoint": "http://127.0.0.1:3000/user-2",
						"publicHost": "http://127.0.0.1:3000"
					}
				}
			}
		}],
		"resolvedReactions": [{
			"uuid": "57f8d94f-3c9f-4adc-8318-c20d299b5696",
			"type": "react",
			"source": "http://127.0.0.1:3000/user-1",
			"about": "http://127.0.0.1:3000/user-2/post/b9cf60f7-dc41-46ff-8695-9b7795d31784",
			"details": {
				"reaction": "thumbsup"
			},
			"createdOn": "2017-12-20T05:44:07.665Z",
			"updatedOn": "2017-12-20T05:44:07.665Z",
			"originator": false,
			"id": 8,
			"userId": 2,
			"friendId": 2,
			"resolvedProfiles": {
				"http://127.0.0.1:3000/user-1": {
					"status": 200,
					"profile": {
						"name": "User One",
						"photo": {
							"url": "/images/slug.png"
						},
						"background": {
							"url": "/images/fpo.jpg"
						},
						"endpoint": "http://127.0.0.1:3000/user-1",
						"publicHost": "http://127.0.0.1:3000"
					}
				},
				"http://127.0.0.1:3000/user-2/post/b9cf60f7-dc41-46ff-8695-9b7795d31784": {
					"status": 200,
					"profile": {
						"name": "User Two",
						"photo": {
							"url": "/images/slug.png"
						},
						"background": {
							"url": "/images/fpo.jpg"
						},
						"endpoint": "http://127.0.0.1:3000/user-2",
						"publicHost": "http://127.0.0.1:3000"
					}
				}
			}
		}],
		"resolvedProfiles": {
			"http://127.0.0.1:3000/user-2": {
				"status": 200,
				"profile": {
					"name": "User Two",
					"photo": {
						"url": "/images/slug.png"
					},
					"background": {
						"url": "/images/fpo.jpg"
					},
					"endpoint": "http://127.0.0.1:3000/user-2",
					"publicHost": "http://127.0.0.1:3000"
				}
			}
		},
		"commentSummary": "by <a href=\"/proxy-profile?endpoint=http%3A%2F%2F127.0.0.1%3A3000%2Fuser-1\">User One</a>",
		"reactionSummary": {
			"summary": "<a href=\"/proxy-profile?endpoint=http%3A%2F%2F127.0.0.1%3A3000%2Fuser-1\">User One</a>",
			"icons": "<div class=\"reaction-button-summary\"><span class=\"em em-thumbsup\"></div>"
		},
		"user": {
			"name": "User Two",
			"username": "user-2",
			"email": "mrhodes+test+proxy2@myantisocial.net",
			"id": 2,
			"createdOn": "2017-12-20T05:44:00.661Z",
			"updatedOn": "2017-12-20T05:44:00.697Z",
			"uploads": []
		},
		"photos": [{
			"status": "complete",
			"title": "photo Title",
			"description": "photo Description",
			"uuid": "db478059-207d-47a6-85c7-b5c93ebf9825",
			"id": 1,
			"userId": 2,
			"createdOn": "2017-12-20T05:44:07.089Z",
			"updatedOn": "2017-12-20T05:44:07.640Z",
			"uploads": [{
				"property": "optimized",
				"type": "JPEG",
				"url": "http://127.0.0.1:3000/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380.jpeg",
				"bucket": "site-uploads",
				"imageSet": {
					"large": {
						"suffix": "large",
						"quality": 90,
						"maxHeight": 2048,
						"maxWidth": 2048,
						"path": "client/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380large.jpeg",
						"width": 3071,
						"height": 2048,
						"url": "http://127.0.0.1:3000/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380large.jpeg"
					},
					"thumb": {
						"suffix": "thumb",
						"quality": 90,
						"maxHeight": 300,
						"maxWidth": 300,
						"path": "client/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380thumb.jpeg",
						"width": 450,
						"height": 300,
						"url": "http://127.0.0.1:3000/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380thumb.jpeg"
					},
					"original": {
						"original": true,
						"width": "1024",
						"height": "683",
						"path": "client/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380.jpeg",
						"url": "http://127.0.0.1:3000/uploads/48aed737-4e21-4f75-ace1-74d4c7de0380.jpeg"
					}
				},
				"id": 1,
				"uploadableId": 1,
				"uploadableType": "Photo",
				"createdOn": "2017-12-20T05:44:07.592Z",
				"updatedOn": "2017-12-20T05:44:07.592Z"
			}]
		}]
	}
}
