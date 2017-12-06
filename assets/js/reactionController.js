(function ($) {
	function reactionController(elem) {
		this.element = $(elem);
		var self = this;

		this.endpoint = this.element.data('endpoint');
		this.postAuthorName = this.element.data('post-author-name');
		this.isMe = this.element.data('is-me');
		this.user = this.element.data('user');
		this.photoId = this.element.data('photoId');

		this.showAll = false;

		this.start = function () {
			this.element.on('mouseenter', function (e) {
				self.element.find('.more-reactions').addClass('shown');
				self.showAll = true;
			});
			this.element.on('mouseleave', function (e) {
				self.element.find('.more-reactions').removeClass('shown');
				self.showAll = false;
			});

			this.element.on('click', '.reaction-button', function (e) {
				if (self.user && !self.isMe) {

					var prev = self.element.find('.selected');
					if (prev.length) {
						prev.removeClass('selected');
					}
					var reaction;
					if (prev[0] !== this) {
						reaction = $(this).data('value');
						$(this).addClass('selected');
					}
					self.saveReaction(reaction);

				}
			});
		};

		this.stop = function () {
			this.element.off('click', 'span');
		};

		this.saveReaction = function (reaction) {
			var payload = {
				'reaction': reaction,
				'endpoint': self.endpoint,
				'postAuthorName': this.postAuthorName,
				'photoId': this.photoId
			};
			$.post('/react', payload, function (data, status, xhr) {
				if (status !== 'success') {
					flashAjaxStatus('error', xhr.statusText);
				}
				else {
					flashAjaxStatus('info', 'reaction saved');
				}
			}, 'json');
		};
	}

	$.fn.reactionController = GetJQueryPlugin('reactionController', reactionController);
})(jQuery);
