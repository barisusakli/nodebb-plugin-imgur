
'use strict';

var request = require('request'),
	winston = require('winston'),
	fs = require('fs'),

	db = module.parent.require('./database');


(function(imgur) {

	var settings;

	db.getObject('nodebb-plugin-imgur', function(err, _settings) {
		if (err) {
			return winston.error(err.message);
		}
		settings = _settings || {};

	});

	imgur.init = function(params, callback) {

		params.router.get('/admin/plugins/imgur', params.middleware.applyCSRF, params.middleware.admin.buildHeader, renderAdmin);
		params.router.get('/api/admin/plugins/imgur', params.middleware.applyCSRF, renderAdmin);

		params.router.post('/api/admin/plugins/imgur/save', params.middleware.applyCSRF, save);

		params.router.get('/admin/plugins/imgur/oauth', authorize);

		callback();
	};

	function renderAdmin(req, res, next) {
		var data = {
			imgurClientID: settings.imgurClientID,
			imgurSecret: settings.imgurSecret,
			albumID: settings.albumID
		};
		res.render('admin/plugins/imgur', {settings: data, csrf: req.csrfToken()});
	}

	function save(req, res, next) {
		var data = {
			imgurClientID: req.body.imgurClientID || '',
			imgurSecret: req.body.imgurSecret || '',
			albumID: req.body.albumID || ''
		};

		db.setObject('nodebb-plugin-imgur', data, function(err) {
			if (err) {
				return next(err);
			}

			settings.imgurClientID = data.imgurClientID;
			settings.imgurSecret = data.imgurSecret;
			settings.albumID = data.albumID;
			res.status(200).json({message: 'Settings saved!'});
		});
	}

	function authorize(req, res, next) {
		if (!req.query.code) {
			return next(new Error('[[error:invalid-code-from-imgur]]'));
		}

		request.post({url: 'https://api.imgur.com/oauth2/token', formData: {
			client_id: settings.imgurClientID,
			client_secret: settings.imgurSecret,
			grant_type: 'authorization_code',
			code: req.query.code
		}}, function(err, response, body) {
			if (err) {
				return next(err);
			}

			saveTokens(body, function(err) {
				if (err) {
					return next(err);
				}
				res.redirect('/admin/plugins/imgur');
			});
		});
	}

	function refreshToken(callback) {
		if (!settings.imgurClientID || !settings.imgurSecret) {
			return callback(new Error('[[error:invalid-imgur-id-or-secret]]'));
		}

		if (!settings.refresh_token) {
			return callback(new Error('[[error:invalid-refresh-token]]'));
		}

		request.post({url: 'https://api.imgur.com/oauth2/token', formData: {
			client_id: settings.imgurClientID,
			client_secret: settings.imgurSecret,
			grant_type: 'refresh_token',
			refresh_token: settings.refresh_token
		}}, function(err, response, body) {
			if (err) {
				return callback(err);
			}

			saveTokens(body, callback);
		});
	}

	function saveTokens(data, callback) {
		try {
			data = JSON.parse(data);
		} catch(err) {
			return callback(err);
		}
		data.expiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000;

		db.setObject('nodebb-plugin-imgur', {
			access_token: data.access_token,
			refresh_token: data.refresh_token,
			expiresAt: data.expiresAt
		}, function(err) {
			if (err) {
				return callback(err);
			}
			settings.access_token = data.access_token;
			settings.refresh_token = data.refresh_token;
			settings.expiresAt = data.expiresAt;
			callback();
		});
	}

	imgur.upload = function (data, callback) {
		if (!settings.imgurClientID) {
			return callback(new Error('invalid-imgur-client-id'));
		}

		var image = data.image;

		if (!image) {
			return callback(new Error('invalid image'));
		}

		var type = image.url ? 'url' : 'file';

		if (type === 'file' && !image.path) {
			return callback(new Error('invalid image path'));
		}

		var imageData = type === 'file' ? fs.createReadStream(image.path) : image.url;

		uploadToImgur(type, imageData, function(err, data) {
			if (err) {
				return callback(err);
			}

			callback(null, {
				url: data.link.replace('http:', 'https:'),
				name: image.name || ''
			});
		});
	};

	function uploadToImgur(type, image, callback) {
		function doUpload(err) {
			if (err) {
				return callback(err);
			}
			var options = {
				url: 'https://api.imgur.com/3/upload.json',
				headers: {
					'Authorization': 'Bearer ' + settings.access_token
				},
				formData: {
					type: type,
					image: image
				}
			};

			if (settings.albumID) {
				options.formData.album = settings.albumID;
			}

			request.post(options, function (err, req, body) {
				if (err) {
					return callback(err);
				}
				var response;
				try {
					response = JSON.parse(body);
				} catch(err) {
					winston.error('Unable to parse Imgur json response. [' + body +']', err.message);
					return callback(err);
				}

				if (response.success) {
					return callback(null, response.data);
				}

				if (response.data.error && response.data.error === 'The access token provided is invalid.') {
					return refreshToken(doUpload);
				}

				callback(new Error(response.data.error.message || response.data.error));
			});
		}

		if (Date.now() >= settings.expiresAt) {
			refreshToken(doUpload);
		} else {
			doUpload();
		}
	}

	var admin = {};

	admin.menu = function(menu, callback) {
		menu.plugins.push({
			route: '/plugins/imgur',
			icon: 'fa-picture-o',
			name: 'Imgur'
		});

		callback(null, menu);
	};


	imgur.admin = admin;

}(module.exports));

