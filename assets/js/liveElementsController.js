// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function liveElementsController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			this.element.on('NotifyLiveElement', function (e, type, about, endpoint, eventType, newsFeedItem) {
				e.stopPropagation();
				self.element.find('.live-element[data-watch="' + about + '"]').each(function () {
					var element = $(this);
					element.addClass('changed');
					if (type === 'post' && eventType === 'delete') {
						element.closest('.newsfeed-item').remove();
					}
					else if (type === 'post' && element.data('watch-type') === type) {
						var item = $('<div>');
						item.load('/proxy-post?endpoint=' + encodeURIComponent(endpoint), function () {
							element.empty().append(item.find('.post').html());
							didInjectContent(element);
						});
					}
					else if (type === 'comments' && element.data('watch-type') === 'comment') {
						var item = $('<div>');
						item.load('/proxy-comments?endpoint=' + encodeURIComponent(endpoint + '/comments'), function () {
							element.find('.comments-list').empty().append(item.find('.comments-list').html());
							didInjectContent(element);
						});
					}
					else if (type === 'comment' && element.data('watch-type') === type) {
						var item = $('<div>');
						item.load('/proxy-comment?endpoint=' + encodeURIComponent(endpoint), function () {
							var comment = item.find('.a-comment');
							var summary = item.find('.comments-label').html();
							if (eventType === 'update') {
								var matches = endpoint.match(/([a-z0-9-]+)$/);

								element.find('#comment-' + matches[1]).empty().append(comment);
							}
							else {
								if (_.get(newsFeedItem, 'details.replyTo')) {
									// find the comment and append to thread
									var matches = newsFeedItem.details.replyTo.match(/([a-z0-9-]+)$/);
									var parentComment = element.find('#comment-' + matches[1]);
									if (parentComment.closest('.a-comment').find('.end-of-thread').length) {
										parentComment.closest('.a-comment').find('.end-of-thread').before(comment);
									}
									else {
										parentComment.closest('.a-comment').nextAll().find('.end-of-thread').first().before(comment);
									}
								}
								else {
									// append to comments
									element.find('.comments').append(comment);
								}
								element.find('.comments-label').empty().append(summary);
							}
							didInjectContent(comment);
						});
					}
					else if (type === 'react' && element.data('watch-type') === type) {
						var item = $('<div>');
						item.load('/proxy-reactions?endpoint=' + encodeURIComponent(endpoint), function () {
							var reactions = item.find('.post-reactions').html();
							element.find('.post-reactions').find('.DigitopiaInstance').trigger('DigitopiaStop');
							element.find('.post-reactions').empty().append(reactions);
							didInjectContent(element);
						})
					}
				});
			});
		};

		this.stop = function () {
			this.element.off('NotifyLiveElement');
		};
	}

	$.fn.liveElementsController = GetJQueryPlugin('liveElementsController', liveElementsController);
})(jQuery);
