(function ($) {
	function reactionController(elem) {
		this.element = $(elem);
		var self = this;

		this.endpoint = this.element.data('endpoint');
		this.photoId = this.element.data('photoId');
		this.description = this.element.data('description');

		this.debounceIn = null;
		this.debounceOut = null;
		this.shown = false;
		this.clickable = false;

		this.start = function () {
			this.element.on('click', function (e) {
				if (self.debounceIn) {
					clearTimeout(self.debounceIn);
				}
				if (self.debounceOut) {
					clearTimeout(self.debounceOut);
				}
				if (!self.shown) {
					self.debounceIn = setTimeout(function () {
						self.debounceIn = undefined;
						self.element.find('.more-reactions').show().animateCss('flipInX', function () {
							self.shown = true;
							self.clickable = true;
							self.element.find('.reaction-details').show().animateCss('fadeInDown');
						});
					}, 500);
				}
				else {
					self.clickable = false;
					self.element.find('.more-reactions').animateCss('flipOutX', function () {
						self.element.find('.more-reactions').hide();
						self.element.find('.reaction-details').show().animateCss('fadeOutUp', function () {
							self.shown = false;
							self.element.find('.reaction-details').hide();
						});
					});
				}
			});

			this.element.on('click', '.reaction-button', function (e) {
				e.preventDefault();
				if (self.clickable) {

					var prev = self.element.find('.selected');
					if (prev.length) {
						prev.removeClass('selected');
					}
					var reaction;
					if (prev[0] !== this) {
						reaction = $(this).data('value');
						$(this).addClass('selected');
					}

					self.clickable = false;
					self.element.find('.more-reactions').animateCss('flipOutX', function () {
						self.shown = false;
						self.element.find('.more-reactions').hide();
						self.saveReaction(reaction);
					});
				}
			});
		};

		this.stop = function () {
			self.element.off('click');
			this.element.off('click', '.reaction-button');
		};

		this.saveReaction = function (reaction) {
			var payload = {
				'reaction': reaction,
				'endpoint': self.endpoint,
				'photoId': this.photoId,
				'description': self.description
			};
			$.post('/react', payload, function (data, status, xhr) {
				if (status !== 'success') {
					flashAjaxStatus('danger', xhr.statusText);
				}
			}, 'json');
		};
	}

	$.fn.reactionController = GetJQueryPlugin('reactionController', reactionController);
})(jQuery);
