"use strict";
/*global app, config, define*/

define('admin/plugins/imgur', [], function() {
	var save = function(callback) {
		var data = {
			_csrf: $('#csrf_token').val(),
			imgurClientID: $('#imgurClientID').val(),
			imgurSecret: $('#imgurSecret').val(),
			albumID: $('#albumID').val()
		};

		$.post(config.relative_path + '/api/admin/plugins/imgur/save', data, function(data) {
			app.alertSuccess(data.message);

			if (typeof callback === 'function') {
				callback();
			}
		});

		return false;
	};

	$('#save').on('click', save);
	$('#authorize').on('click', function() {
		save(function() {
			var clientID = $('#imgurClientID').val();
			if (!clientID) {
				return app.alertError('[[error:no-imgur-client-id]]');
			}

			window.location = 'https://api.imgur.com/oauth2/authorize?client_id=' + clientID + '&response_type=code';
		});
	});
});