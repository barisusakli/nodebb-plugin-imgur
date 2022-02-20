
'use strict';

const request = require('request');
const fs = require('fs');
const util = require('util');

const winston = require.main.require('winston');
const db = require.main.require('./src/database');
const user = require.main.require('./src/user');

const requestAsync = util.promisify((verb, options, callback) => {
	request[verb](options, (err, res, body) => {
		if (err) {
			return callback(err);
		}
		callback(null, body);
	});
});

const imgur = module.exports;

const dbSettingsKey = 'nodebb-plugin-imgur';

imgur.init = async function (params) {
	params.router.get('/admin/plugins/imgur', params.middleware.applyCSRF, params.middleware.admin.buildHeader, renderAdmin);
	params.router.get('/api/admin/plugins/imgur', params.middleware.applyCSRF, renderAdmin);

	params.router.post('/api/admin/plugins/imgur/save', params.middleware.applyCSRF, save);

	params.router.post('/admin/plugins/imgur/tokens', postTokens);
};

async function getSettings() {
	return (await db.getObject(dbSettingsKey)) || {};
}

async function renderAdmin(req, res) {
	const settings = await getSettings();
	const data = {
		imgurClientID: settings.imgurClientID,
		imgurSecret: settings.imgurSecret,
		albumID: settings.albumID,
		needsAuthorization: !settings.access_token || !settings.refresh_token,
	};
	res.render('admin/plugins/imgur', {
		settings: data,
		csrf: req.csrfToken(),
	});
}

async function save(req, res) {
	await db.setObject('nodebb-plugin-imgur', {
		imgurClientID: req.body.imgurClientID || '',
		imgurSecret: req.body.imgurSecret || '',
		albumID: req.body.albumID || '',
	});
	res.status(200).json({ message: 'Settings saved!' });
}

async function postTokens(req, res, next) {
	try {
		await saveTokens({
			access_token: req.body.access_token,
			refresh_token: req.body.refresh_token,
			expires_in: req.body.expires_in,
		});
		res.json('success');
	} catch (err) {
		next(err);
	}
}

async function refreshToken() {
	const settings = await getSettings();
	if (!settings.imgurClientID || !settings.imgurSecret) {
		throw new Error('[[error:invalid-imgur-id-or-secret]]');
	}

	if (!settings.refresh_token) {
		throw new Error('[[error:invalid-refresh-token]]');
	}

	const body = await requestAsync('post', {
		url: 'https://api.imgur.com/oauth2/token',
		formData: {
			client_id: settings.imgurClientID,
			client_secret: settings.imgurSecret,
			grant_type: 'refresh_token',
			refresh_token: settings.refresh_token,
		},
	});
	const data = JSON.parse(body);
	if (data && !data.success && data.error) {
		throw new Error(data.error);
	}
	await saveTokens(data);
}

async function saveTokens(data) {
	data.expiresAt = Date.now() + (parseInt(data.expires_in, 10) * 1000);

	if (!data.access_token) {
		throw new Error('[[error:unable-to-get-access-token]]');
	}

	if (!data.refresh_token) {
		throw new Error('[[error:unable-to-get-refresh-token]]');
	}

	await db.setObject(dbSettingsKey, {
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		expiresAt: data.expiresAt,
	});
}

async function deleteImageByHash(imageHash) {
	const settings = await getSettings();
	if (!settings.imgurClientID) {
		throw new Error('invalid-imgur-client-id');
	}
	if (Date.now() >= settings.expiresAt) {
		await refreshToken();
	}
	const body = await requestAsync('delete', {
		url: `https://api.imgur.com/3/image/${imageHash}`,
		headers: {
			Authorization: `Bearer ${settings.access_token}`,
		},
	});
	let response;
	try {
		response = JSON.parse(body);
	} catch (err) {
		winston.error(`Unable to parse Imgur json response. [' ${body} ']\n${err.message}`);
		throw new Error('[[error:imgur-json-parse-error]]');
	}

	if (response.success) {
		return;
	}

	if (response.data.error && response.data.error === 'The access token provided is invalid.') {
		await refreshToken();
		await deleteImageByHash(imageHash);
		return;
	}
	throw new Error(response.data.error.message || response.data.error);
}

async function deleteUserImage(pictureUrl) {
	if (!pictureUrl) {
		return;
	}
	const match = pictureUrl.match(/^http.+imgur.+\/(.+)\./);
	if (match && match[1]) {
		await deleteImageByHash(match[1]);
	}
}

async function deleteCurrentImage(uid, field) {
	const userData = await user.getUserData(uid);
	await deleteUserImage(userData && userData[field]);
}

imgur.upload = async function (data) {
	if (!data.image) {
		throw new Error('invalid image');
	}
	const settings = await getSettings();
	if (!settings.imgurClientID) {
		throw new Error('invalid-imgur-client-id');
	}

	// uploading a new profile image or cover will delete old one
	if (data.uid && data.folder === 'profile') {
		if (data.image.name === 'profileAvatar') {
			await deleteCurrentImage(data.uid, 'uploadedpicture');
		} else if (data.image.name === 'profileCover') {
			await deleteCurrentImage(data.uid, 'cover:url');
		}
	}

	if (Date.now() >= settings.expiresAt) {
		await refreshToken();
	}
	return await doUpload(data, settings);
};

async function doUpload(data, settings) {
	const { image } = data;
	const type = image.url ? 'url' : 'file';
	if (type === 'file' && !image.path) {
		throw new Error('invalid image path');
	}

	let formDataImage;
	if (type === 'file') {
		formDataImage = fs.createReadStream(image.path);
		formDataImage.on('error', (err) => {
			winston.error(`error reaing stream :\n${err.stack}`);
		});
	} else if (type === 'url') {
		formDataImage = image.url;
	} else {
		throw new Error('unknown-type');
	}

	const options = {
		url: 'https://api.imgur.com/3/upload.json',
		headers: {
			Authorization: `Bearer ${settings.access_token}`,
		},
		formData: {
			type: type,
			image: formDataImage,
		},
	};

	if (settings.albumID) {
		options.formData.album = settings.albumID;
	}
	const body = await requestAsync('post', options);
	let response;
	try {
		response = JSON.parse(body);
	} catch (err) {
		winston.error(`Unable to parse Imgur json response. [' ${body} ']'\n${err.message}`);
		throw err;
	}

	if (response.success) {
		return {
			name: image.name,
			url: response.data.link.replace('http:', 'https:'),
		};
	}

	if (response.data.error && response.data.error === 'The access token provided is invalid.') {
		await refreshToken();
		return await imgur.upload(data);
	}

	throw new Error(response.data.error.message || response.data.error);
}

imgur.actionUserDelete = async function (hookData) {
	await deleteUserImage(hookData.user && hookData.user.uploadedpicture);
	await deleteUserImage(hookData.user && hookData.user['cover:url']);
};

imgur.actionUserRemoveUploadedPicture = async function (hookData) {
	await deleteUserImage(hookData.user && hookData.user.uploadedpicture);
};

imgur.actionUserRemoveCoverPicture = async function (hookData) {
	await deleteUserImage(hookData.user && hookData.user['cover:url']);
};

imgur.admin = {};

imgur.admin.menu = async function (menu) {
	menu.plugins.push({
		route: '/plugins/imgur',
		icon: 'fa-cloud-upload',
		name: 'Imgur',
	});
	return menu;
};
