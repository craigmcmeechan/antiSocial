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
