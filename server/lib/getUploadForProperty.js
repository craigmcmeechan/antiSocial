// this function expects
//  prop: property that was specified when the image was uploaded eg. "photo" "background"
//  uploads: array of Uploads to scan
// if nothing is found it returns a slug graphic (/images/fpo.jpg)
// otherwise it returns the url of the desired upload
module.exports = function getUploadForProperty(prop, uploads, type, fpo) {
	if (uploads && uploads.length) {
		for (var j = 0; j < uploads.length; j++) {
			if (uploads[j].property === prop) {
				if (type) {
					if (uploads[j].imageSet[type]) {
						return uploads[j].imageSet[type];
					}
				}
				return uploads[j];
			}
		}
	}
	if (fpo) {
		return {
			'url': fpo
		};
	}
	return null;
};
