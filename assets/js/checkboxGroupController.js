// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function checkboxGroupController(elem, options) {
		this.element = $(elem);
		this.target = this.element.find(this.element.data('target'));
		this.list = [];
		this.inputs = this.element.find('input');

		var self = this;

		// get value from target and precheck
		// listen for clicks
		// update target after changes
		this.start = function () {
			var val = self.target.val() ? self.target.val() : '[]';
			try {
				self.list = JSON.parse(val);
			}
			catch (e) {}

			self.element.on('click', 'input', function (e) {
				self.list = [];
				self.inputs.each(function () {
					if ($(this).is(':checked')) {
						var value = $(this).data('value');
						self.list.push(value);
					}
				});
				self.updateTarget();
			});

			self.preselect();
		};

		this.stop = function () {
			self.element.off('click', 'input');
		};

		this.updateTarget = function () {
			self.target.val(JSON.stringify(self.list));
			self.target.trigger('change');
		};

		this.preselect = function () {
			for (var i = 0; i < self.list.length; i++) {
				var option = self.list[i];
				for (var j = 0; j < this.inputs.length; j++) {
					var input = $(this.inputs[j]);
					if (input.data('value') === option) {
						input.prop('checked', 'checked');
					}
				}
			}
		};
	}

	$.fn.checkboxGroupController = GetJQueryPlugin('checkboxGroupController', checkboxGroupController);
})(jQuery);
