
'use strict';

var request = require('request'),
	winston = require('winston'),
	fs = require('fs'),

	db = module.parent.require('./database');


(function(imgur) {

	var imgurClientID = '';

	db.getObjectField('nodebb-plugin-imgur', 'imgurClientID', function(err, id) {
		if(err) {
			return winston.error(err.message);
		}
		imgurClientID = id;
	});

	imgur.init = function(app, middleware, controllers, callback) {

		app.get('/admin/plugins/imgur', middleware.applyCSRF, middleware.admin.buildHeader, renderAdmin);
		app.get('/api/admin/plugins/imgur', middleware.applyCSRF, renderAdmin);

		app.post('/api/admin/plugins/imgur/save', middleware.applyCSRF, save);
		callback();
	};

	function renderAdmin(req, res, next) {
		db.getObjectField('nodebb-plugin-imgur', 'imgurClientID', function(err, imgurClientID) {
			if (err) {
				return next(err);
			}

			res.render('admin/plugins/imgur', {imgurClientID: imgurClientID, csrf: req.csrfToken()});
		});
	}

	function save(req, res, next) {
		if(req.body.imgurClientID !== null && req.body.imgurClientID !== undefined) {
			db.setObjectField('nodebb-plugin-imgur', 'imgurClientID', req.body.imgurClientID, function(err) {
				if (err) {
					return next(err);
				}

				imgurClientID = req.body.imgurClientID;
				res.json(200, {message: 'Imgur Client ID saved!'});
			});
		}
	}

	imgur.upload = function (data, callback) {
		if (!imgurClientID) {
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
		var options = {
			url: 'https://api.imgur.com/3/upload.json',
			headers: {
				'Authorization': 'Client-ID ' + imgurClientID
			}
		};

		var post = request.post(options, function (err, req, body) {
			if (err) {
				return callback(err);
			}

			try {
				var response = JSON.parse(body);

				if(response.success) {
					callback(null, response.data);
				} else {
					callback(new Error(response.data.error.message));
				}
			} catch(e) {
				winston.error('Unable to parse Imgur json response. [' + body +']', e.message);
				callback(e);
			}
		});

		var upload = post.form();
		upload.append('type', type);
		upload.append('image', image);
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

