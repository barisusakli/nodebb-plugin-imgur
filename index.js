
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

	imgur.init = function(app, middleware, controllers) {

		app.get('/admin/plugins/imgur', middleware.admin.buildHeader, renderAdmin);
		app.get('/api/admin/plugins/imgur', renderAdmin);

		app.post('/api/admin/plugins/imgur/save', save);
	};

	function renderAdmin(req, res, next) {
		db.getObjectField('nodebb-plugin-imgur', 'imgurClientID', function(err, imgurClientID) {
			if (err) {
				return next(err);
			}

			res.render('admin/imgur', {imgurClientID: imgurClientID});
		});
	}

	function save(req, res, next) {
		console.log('saved called');
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

	imgur.upload = function (image, callback) {
		if(!imgurClientID) {
			return callback(new Error('invalid-imgur-client-id'));
		}

		if(!image || !image.path) {
			return callback(new Error('invalid image'));
		}

		uploadToImgur(imgurClientID, image, function(err, data) {
			if(err) {
				return callback(err);
			}

			callback(null, {
				url: data.link.replace('http:', 'https:'),
				name: image.name
			});
		});
	};

	function uploadToImgur(clientID, image, callback) {
		var options = {
			url: 'https://api.imgur.com/3/upload.json',
			headers: {
				'Authorization': 'Client-ID ' + clientID
			}
		};

		var post = request.post(options, function (err, req, body) {
			if(err) {
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
				winston.error('Unable to parse Imgur json response. [' + body +']');
				callback(e);
			}
		});

		var upload = post.form();
		upload.append('type', 'file');
		upload.append('image', fs.createReadStream(image.path));
	}

	var admin = {};

	admin.menu = function(custom_header) {
		custom_header.plugins.push({
			route: '/plugins/imgur',
			icon: 'fa-picture-o',
			name: 'Imgur'
		});

		return custom_header;
	};


	imgur.admin = admin;

}(module.exports));

