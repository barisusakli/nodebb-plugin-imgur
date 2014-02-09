
var request = require('request'),
	winston = require('winston'),
	fs = require('fs'),
	path = require('path'),

	db = module.parent.require('./database'),
	templates = module.parent.require('./../public/src/templates');

(function(imgur) {
	"use strict";

	var imgurClientID = '';

	db.getObjectField('nodebb-plugin-imgur', 'imgurClientID', function(err, id) {
		if(err) {
			return winston.error(err.message);
		}
		imgurClientID = id;
	});

	imgur.upload = function (image, callback) {
		if(!imgurClientID) {
			return callback(new Error('invalid-imgur-client-id'));
		}

		if(!image) {
			return callback(new Error('invalid image'));
		}

		if(!image.base64 && !image.file && !image.url) {
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
	}

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

		var type = 'base64';
		if(image.file) {
			type = 'file';
		} else if(image.url) {
			type = 'URL';
		}

		var upload = post.form();
		upload.append('type', type);

		if(image.base64) {
			upload.append('image', image.base64);
		} else if(image.file) {
			upload.append('image', fs.createReadStream(image.file));
		} else if(image.url) {
			upload.append('image', image.url);
		}
	};

	var admin = {};

	admin.menu = function(custom_header, callback) {
		custom_header.plugins.push({
			"route": '/plugins/imgur',
			"icon": 'fa-picture-o',
			"name": 'Imgur'
		});

		return custom_header;
	};

	admin.route = function(custom_routes, callback) {

		fs.readFile(path.join(__dirname, 'public/templates/admin.tpl'), function(err, tpl) {

			custom_routes.routes.push({
				route: '/plugins/imgur',
				method: 'get',
				options: function(req, res, callback) {

					db.getObjectField('nodebb-plugin-imgur', 'imgurClientID', function(err, imgurClientID) {

						var newTpl = templates.prepare(tpl.toString()).parse({imgurClientID: imgurClientID});

						callback({
							req: req,
							res: res,
							route: '/plugins/imgur',
							name: 'Imgur',
							content: newTpl
						});
					});
				}
			});

			custom_routes.api.push({
				route: '/plugins/imgur/save',
				method: 'post',
				callback: function(req, res, callback) {

					if(req.body.imgurClientID !== null && req.body.imgurClientID !== undefined) {
						db.setObjectField('nodebb-plugin-imgur', 'imgurClientID', req.body.imgurClientID);
					}

					callback({message: 'Imgur Client ID saved!'});
				}
			});

			callback(null, custom_routes);
		});
	};

	imgur.admin = admin;

}(module.exports));

