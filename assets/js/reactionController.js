(function ($) {
	function reactionController(elem) {
		this.element = $(elem);
		var self = this;

		this.endpoint = this.element.data('endpoint');
		this.postAuthorName = this.element.data('post-author-name');
		this.isMe = this.element.data('is-me');
		this.user = this.element.data('user');
		this.photoId = this.element.data('photoId');

		this.debounce = null;
		this.shown = false;

		this.start = function () {
			self.element.on('mouseleave', function (e) {
				if (!self.debounce && self.shown) {
					self.shown = false;
					self.element.find('.more-reactions').animateCss('fadeOutLeft', function () {
						self.element.find('.more-reactions').hide();
					});
				}
				if (self.debounce) {
					clearTimeout(self.debounce);
				}
			});

			this.element.on('mouseenter', function (e) {
				if (self.debounce) {
					clearTimeout(self.debounce);
				}
				self.debounce = setTimeout(function () {
					self.debounce = undefined;
					self.shown = true;
					self.element.find('.more-reactions').show().animateCss('fadeInLeft', function () {
						self.element.one('mouseleave', function (e) {
							if (self.debounce) {
								clearTimeout(self.debounce);
							}
							if (self.shown) {
								self.debounce = setTimeout(function () {
									self.debounce = undefined;
									self.shown = false;
									self.element.find('.more-reactions').animateCss('fadeOutLeft', function () {
										self.element.find('.more-reactions').hide();
									});
								});
							}
						});
					});
				}, 500);
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
			self.element.off('mouseleave');
			self.element.off('mouseleave');
			this.element.off('click', '.reaction-button');
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
					self.element.closest('.ajax-load').trigger('ReloadElement');
					$('body').trigger('DigitopiaReloadPage');
				}
			}, 'json');
		};
	}

	$.fn.reactionController = GetJQueryPlugin('reactionController', reactionController);
})(jQuery);
