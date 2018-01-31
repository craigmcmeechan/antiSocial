(function ($) {

	function ajaxLoadController(elem) {
		this.element = $(elem);

		var self = this;

		this.endpoint = this.element.data('endpoint');
		this.id = this.element.attr('id');

		this.start = function () {
			this.element.on('ReloadElement', function (e) {
				e.stopPropagation();
				if (e.target === this) {
					$.ajax({
						type: 'GET',
						url: self.endpoint
					}).done(function (html) {
						$('#' + self.id).find('.DigitopiaInstance').trigger('DigitopiaStop');
						var doc = html.split(/(<body[^>]*>|<\/body>)/ig);
						var docBody = html;
						if (doc.length > 1) {
							docBody = $(doc[2]);
						}
						var chunk = '';
						chunk = $(docBody).find('#' + self.id);
						if (!chunk || chunk.length === 0) {
							chunk = $(docBody).filter('#' + self.id);
						}
						$('#' + self.id).find('.DigitopiaInstance').trigger('DigitopiaStop');
						$('#' + self.id).html(chunk.children());
						didInjectContent($('#' + self.id));
					}).fail(function (jqXHR, textStatus, errorThrown) {
						$('#' + self.id).html('Could not load item. Server is offline or item deleted.')
					});
				}
			});
		}

		this.stop = function () {
			this.element.off('ReloadElement');
		}

	}

	$.fn.ajaxLoadController = GetJQueryPlugin('ajaxLoadController', ajaxLoadController);

})(jQuery);
