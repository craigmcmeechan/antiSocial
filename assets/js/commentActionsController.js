// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {

	function commentActionsController(elem) {
		this.element = $(elem);

		var self = this;

		this.isMine = this.element.data('is-mine');
		this.commentId = this.element.data('comment-id');

		this.start = function () {
			if (self.isMine) {
				this.element.on('click', '.delete-comment', function (e) {
					e.preventDefault();

					var endpoint = '/comment/' + self.commentId;
					$.ajax({
						'method': 'DELETE',
						url: endpoint
					}).done(function (data) {
						if (_.get(data, 'result.status') === 'ok') {
							flashAjaxStatus('info', 'deleted');
						}
						else {
							flashAjaxStatus('danger', _.get(data, 'result.status') ? _.get(data, 'result.status') : 'an error occured');
						}
					}).fail(function (jqXHR, textStatus, errorThrown) {
						flashAjaxStatus('danger', 'could not delete ', textStatus);
					});
				});

				this.element.on('click', '.edit-comment', function (e) {
					e.preventDefault();

					var target = '#edit-comment-form';

					var modal = $(target);
					modal.find('.mdc-dialog__content').empty().append('loading...');
					modal.find('.mdc-dialog__content').load('/comment/' + self.commentId, function () {
						didInjectContent(modal);
						var dialog = new MDC.MDCDialog(document.querySelector(target));
						$(target).data('mdc-dialog', dialog);
						dialog.open();
					});
				});
			}
		};

		this.stop = function () {
			if (self.isMine) {
				this.element.off('click', '.delete-comment');
				this.element.off('click', '.edit-comment');
			}
		};

	}

	$.fn.commentActionsController = GetJQueryPlugin('commentActionsController', commentActionsController);

})(jQuery);
