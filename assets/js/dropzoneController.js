(function ($) {
	// disable dropzone auto instantiation
	Dropzone.autoDiscover = false;

	// define dropzoneController
	function dropzoneController(elem, options) {
		this.element = $(elem);

		var self = this;

		// get the upload endpoint from the html data-endpoint= tag
		this.settings = $.extend({
			endpoint: this.element.data('endpoint')
		}, options || {});

		this.dropzone = undefined;

		this.start = function () {

			this.dropzone = new Dropzone(this.element[0], {
				'url': self.settings.endpoint,
				'paramName': 'uploadedFile',
				'uploadMultiple': false,
				'parallelUploads': 1,
				'maxFiles': 1,
				'timeout': 300 * 1000,
				'init': function () {

					// only allow single file upload
					this.on('maxfilesexceeded', function (file) {
						this.removeAllFiles();
						this.addFile(file);
					});

					// provide feedback that upload is processing
					this.on("processing", function () {
						self.element.addClass('loading');
						flashAjaxStatus('info', 'uploading image');
					});

					// on success, update the current image in the markup
					this.on("success", function (dzfile, body) {
						var response = body.response;
						var s3file = response.url;
						var img = self.element.parent().find('img').first();
						img.attr('src', '');
						img.attr('src', s3file);
						img.data('lazy-src', s3file);
						self.element.removeClass('loading');
						flashAjaxStatus('info', 'upload complete');
						//$('body').trigger('DigitopiaReloadPage');
					});

					// remove the thumbnail from the dropzone UI
					this.on("complete", function (file) {
						this.removeFile(file);
					});
				}
			});

		};

		this.stop = function () {};
	}

	$.fn.dropzoneController = GetJQueryPlugin('dropzoneController', dropzoneController);
})(jQuery);
