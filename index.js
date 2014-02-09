
var request = require('request'),
	winston = require('winston'),
	fs = require('fs'),
	path = require('path'),

	db = module.parent.require('./database'),
	templates = module.parent.require('./../public/src/templates'),
	meta = module.parent.require('./meta');

(function(imgur) {
	"use strict";

	imgur.upload = function (image, callback) {
		if(!image || !image.data) {
			return callback(new Error('invalid image'));
		}

		uploadToImgur(meta.config.imgurClientID, image.data, 'base64', function(err, data) {
			if(err) {
				return callback(err);
			}

			callback(null, {
				url: data.link,
				name: image.name
			});
		});
	}

	function uploadToImgur(clientID, image, type, callback) {
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

		post.form({
			type: type,
			image: image
		});
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

