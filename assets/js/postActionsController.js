// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {

	function postActionsController(elem) {
		this.element = $(elem);

		var self = this;

		this.isMine = this.element.data('is-mine');
		this.postId = this.element.data('post-id');
		this.postEndPoint = this.element.closest('.post').data('endpoint');
		this.isOnMyWall = this.element.data('is-on-my-wall');

		this.start = function () {
			if (self.isMine || this.isOnMyWall) {
				this.element.find('.delete-post').confirmation({
					'container': 'body',
					'title': 'Confirm',
					'placement': 'bottom',
					'onCancel': function () {},
					'onConfirm': function () {
						var endpoint = '/post/' + self.postId;
						$.ajax({
							'method': 'DELETE',
							url: endpoint
						}).done(function (data) {
							if (_.get(data, 'result.status') === 'ok') {
								flashAjaxStatus('info', 'deleted');
								self.element.closest('.newsfeed-item').remove();
							}
							else {
								flashAjaxStatus('danger', _.get(data, 'result.status') ? _.get(data, 'result.status') : 'an error occured');
							}
						}).fail(function (jqXHR, textStatus, errorThrown) {
							flashAjaxStatus('danger', 'could not delete ', textStatus);
						});
					}
				});

				this.element.on('click', '.edit-post', function (e) {
					e.preventDefault();

					var target = '#edit-post-form';

					var modal = $(target);
					modal.find('.mdc-dialog__body').empty().append('loading...');
					modal.find('.mdc-dialog__body').load('/post/' + self.postId, function () {
						didInjectContent(modal);
					});

					var dialog = new MDC.MDCDialog(document.querySelector(target));
					$(target).data('mdc-dialog', dialog);
					dialog.show();
				});
			}
			this.element.on('click', '.share-post', function (e) {
				e.stopPropagation();
				e.preventDefault();
				$('#post-form').find('form').data('postingFormController').setShareMode(self.postEndPoint);
				$('#post-form').find('.posting-body').click().keyup().focus();

				var target = '#post-form';
				var modal = $(target);
				var dialog = new MDC.MDCDialog(document.querySelector(target));
				$(target).data('mdc-dialog', dialog);
				dialog.show();
			});
		};

		this.stop = function () {
			if (self.isMine) {
				this.element.off('click', '.edit-post');
				this.element.off('click', '.share-post');
				this.element.find('.delete-post').confirmation('dispose');
			}
		};

	}

	$.fn.postActionsController = GetJQueryPlugin('postActionsController', postActionsController);

})(jQuery);
