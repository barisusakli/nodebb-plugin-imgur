
'use strict';

var request = require('request');
var winston = require('winston');

var fs = require('fs');
var nconf = require.main.require('nconf');
var async = require.main.require('async');

var db = module.parent.require('./database');

(function(imgur) {

	var dbSettingsKey = 'nodebb-plugin-imgur';

	imgur.init = function(params, callback) {

		params.router.get('/admin/plugins/imgur', params.middleware.applyCSRF, params.middleware.admin.buildHeader, renderAdmin);
		params.router.get('/api/admin/plugins/imgur', params.middleware.applyCSRF, renderAdmin);

		params.router.post('/api/admin/plugins/imgur/save', params.middleware.applyCSRF, save);

		params.router.get('/admin/plugins/imgur/oauth', authorize);

		callback();
	};

	function renderAdmin(req, res, next) {
		db.getObject(dbSettingsKey, function(err, settings) {
			if (err) {
				return next(err);
			}
			settings = settings || {};
			var data = {
				imgurClientID: settings.imgurClientID,
				imgurSecret: settings.imgurSecret,
				albumID: settings.albumID,
				needsAuthorization: !settings.access_token || !settings.refresh_token
			};
			res.render('admin/plugins/imgur', {settings: data, csrf: req.csrfToken()});
		});
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

			res.status(200).json({message: 'Settings saved!'});
		});
	}

	function authorize(req, res, next) {
		if (!req.query.code) {
			return next(new Error('[[error:invalid-code-from-imgur]]'));
		}
		var settings;
		async.waterfall([
			function(next) {
				db.getObject(dbSettingsKey, next);
			},
			function(_settings, next) {
				settings = _settings || {};

				if (!settings.imgurClientID) {
					return next(new Error('[[error:no-imgur-client-id]]'));
				}

				if (!settings.imgurSecret) {
					return next(new Error('[[error:no-imgur-secret]]'));
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
					saveTokens(body, next);
				});
			}
		], function(err) {
			if (err) {
				return next(err);
			}
			res.redirect(nconf.get('relative_path') + '/admin/plugins/imgur');
		});
	}

	function refreshToken(callback) {
		async.waterfall([
			function(next) {
				db.getObject(dbSettingsKey, next);
			},
			function(settings, next) {
				settings = settings || {};

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

					saveTokens(body, next);
				});
			}
		], callback);
	}

	function saveTokens(data, callback) {
		try {
			data = JSON.parse(data);
		} catch(err) {
			return callback(err);
		}
		data.expiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000;

		if (!data.access_token) {
			return callback(new Error('[[error:unable-to-get-access-token]]'));
		}

		if (!data.refresh_token) {
			return callback(new Error('[[error:unable-to-get-refresh-token]]'));
		}

		db.setObject(dbSettingsKey, {
			access_token: data.access_token,
			refresh_token: data.refresh_token,
			expiresAt: data.expiresAt
		}, function(err) {
			callback(err);
		});
	}

	imgur.upload = function (data, callback) {
		var settings;
		var image = data.image;

		if (!image) {
			return callback(new Error('invalid image'));
		}

		async.waterfall([
			function(next) {
				db.getObject(dbSettingsKey, next);
			},
			function(_settings, next) {
				settings = _settings || {};

				if (!settings.imgurClientID) {
					return next(new Error('invalid-imgur-client-id'));
				}

				if (Date.now() >= settings.expiresAt) {
					refreshToken(next);
				} else {
					next();
				}
			},
			function (next) {
				doUpload(data, settings, next);
			}
		], callback);
	};

	function doUpload(data, settings, callback) {
		function done(err) {
			if (!callbackCalled) {
				callbackCalled = true;
				callback(err);
			}
		}

		var image = data.image;

		var callbackCalled = false;
		var type = image.url ? 'url' : 'file';
		if (type === 'file' && !image.path) {
			return callback(new Error('invalid image path'));
		}

		var formDataImage;
		if (type === 'file') {
			formDataImage = fs.createReadStream(image.path);
			formDataImage.on('error', function(err) {
				done(err);
			});
		} else if (type === 'url') {
			formDataImage = image.url;
		} else {
			return callback(new Error('unknown-type'));
		}

		var options = {
			url: 'https://api.imgur.com/3/upload.json',
			headers: {
				'Authorization': 'Bearer ' + settings.access_token
			},
			formData: {
				type: type,
				image: formDataImage
			}
		};

		if (settings.albumID) {
			options.formData.album = settings.albumID;
		}

		request.post(options, function (err, req, body) {
			if (err) {
				return done(err);
			}

			var response;
			try {
				response = JSON.parse(body);
			} catch(err) {
				winston.error('Unable to parse Imgur json response. [' + body +']', err.message);
				return done(err);
			}

			if (response.success) {
				return callback(null, {
					name: image.name,
					url: response.data.link.replace('http:', 'https:')
				});
			}

			if (response.data.error && response.data.error === 'The access token provided is invalid.') {
				async.waterfall([
					function(next) {
						refreshToken(next);
					},
					function(next) {
						imgur.upload(data, next);
					}
				], callback);
				return;
			}

			done(new Error(response.data.error.message || response.data.error));
		});
	}


	var admin = {};

	admin.menu = function(menu, callback) {
		menu.plugins.push({
			route: '/plugins/imgur',
			icon: 'fa-cloud-upload',
			name: 'Imgur'
		});

		callback(null, menu);
	};


	imgur.admin = admin;

}(module.exports));

