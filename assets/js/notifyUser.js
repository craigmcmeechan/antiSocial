// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

function notifyUser(type, message, icon, link) {
	if (window.Notification && Notification.requestPermission) {
		var myNotification = new Notify(type, {
			body: message,
			timeout: 30,
			icon: icon,
			notifyClick: function () {
				$('body').trigger('DigitopiaLoadPage', link);
			}
		});

		function showNotification() {
			myNotification.show();
		}

		function optoutNotification() {}

		if (window.Notification && !Notify.needsPermission) {
			showNotification();
		}
		else if (Notify.isSupported()) {
			Notify.requestPermission(showNotification, optoutNotification);
		}
	}
	else {}
}
