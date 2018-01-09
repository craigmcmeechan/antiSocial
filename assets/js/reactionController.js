(function ($) {
	function reactionController(elem) {
		this.element = $(elem);
		var self = this;

		this.endpoint = this.element.data('endpoint');
		this.photoId = this.element.data('photoId');

		this.debounce = null;
		this.shown = false;

		this.start = function () {
			self.element.on('mouseleave', function (e) {
				if (!self.debounce && self.shown) {
					self.shown = false;
					self.element.find('.more-reactions').animateCss('fadeOutRight', function () {
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
					self.element.find('.more-reactions').show().animateCss('fadeInRight', function () {
						self.element.one('mouseleave', function (e) {
							if (self.debounce) {
								clearTimeout(self.debounce);
							}
							if (self.shown) {
								self.debounce = setTimeout(function () {
									self.debounce = undefined;
									self.shown = false;
									self.element.find('.more-reactions').animateCss('fadeOutRight', function () {
										self.element.find('.more-reactions').hide();
									});
								});
							}
						});
					});
				}, 500);
			});


			this.element.on('click', '.reaction-button', function (e) {

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
				'photoId': this.photoId
			};
			$.post('/react', payload, function (data, status, xhr) {
				if (status !== 'success') {
					flashAjaxStatus('error', xhr.statusText);
				}
				else {
					//flashAjaxStatus('info', 'reaction saved');
					//self.element.closest('.ajax-load').trigger('ReloadElement');
				}
			}, 'json');
		};
	}

	$.fn.reactionController = GetJQueryPlugin('reactionController', reactionController);
})(jQuery);
