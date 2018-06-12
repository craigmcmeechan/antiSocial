// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function editListController(elem, options) {
		this.element = $(elem);
		this.target = $(this.element.data('target'));
		this.addOnly = this.element.data('add-only');
		this.list = [];
		this.originalLength = 0;
		var self = this;

		this.start = function () {
			var val = self.target.val() ? self.target.val() : '[]';
			try {
				self.list = JSON.parse(val);
			}
			catch (e) {}

			this.originalLength = self.list.length;

			self.element.on('click', 'button', function (e) {
				e.preventDefault();
				var index = $(this).data('index');
				var value = self.element.find('[data-index=' + index + ']').val();
				var mode = $(this).data('mode');
				if (value) {
					if (mode === 'remove') {
						self.list.splice(index, 1);
					}
					else {
						self.list.push(value);
					}
					self.updateTarget();
					self.renderForm();
				}
			});

			self.renderForm();
		};

		this.stop = function () {

		};

		this.updateTarget = function () {
			self.target.val(JSON.stringify(self.list));
			self.target.trigger('change');
		};

		this.renderForm = function () {
			self.element.empty();
			for (var i = 0; i < self.list.length; i++) {
				var value = self.list[i];
				self.addRow(i, value);
			}
			this.addRow(self.list.length);
		};

		this.addRow = function (i, value) {
			var row = $('<div>');

			if (self.addOnly && i < self.originalLength) {
				row.append(value);
			}
			else {
				var input = $('<input data-index="' + i + '">');
				var button = $('<button data-index="' + i + '">');
				if (value) {
					button.data('mode', 'remove');
					button.append('-');
				}
				else {
					button.append('+');
				}
				input.val(value);
				row.append(input, button);
			}
			self.element.append(row);
		};
	}

	$.fn.editListController = GetJQueryPlugin('editListController', editListController);
})(jQuery);
