<div class="alert alert-info">
<ul>
	<li>
		<p>Register an imgur app <a href="https://api.imgur.com/oauth2/addclient">here</a>, make sure you fill in the callback URL properly. It should be <code>http://yourforum.com/admin/plugins/imgur</code> adjust based on your forum url.
		</p>
	</li>
	<li>
		<p>
		Once you register you will get a client ID and secret. Enter these values below.
		</p>
	</li>
	<li><p>Optionally, create an album for your forum on imgur and put its album ID below. You can find the ID by going to the album URL and taking the characters after the `/a`. Ex. for `http://imgur.com/a/abcdef`, the ID is `abcdef`</p></li>

	<li><p>After entering the values click Save and then Authorize, you will be redirected to imgur to allow access to your app. </p></li>
	<li><p>Once you allow access you will be redirected back to nodebb.</p></li>
</ul>
</div>

<form class="form">
	<div class="row mb-4">
		<div class="col-sm-6 col-12">
			<div class="mb-3">
				<label class="form-label">Imgur Client ID</label>
				<input id="imgurClientID" type="text" class="form-control" placeholder="Enter Imgur Client ID" value="{settings.imgurClientID}">
			</div>
			<div class="mb-3">
				<label class="form-label">Imgur Secret</label>
				<input id="imgurSecret" type="text" class="form-control" placeholder="Enter Imgur Secret" value="{settings.imgurSecret}">
			</div>
			<div>
				<label class="form-label">Album ID</label>
				<input id="albumID" type="text" class="form-control" placeholder="Enter Album ID" value="{settings.albumID}">
			</div>
		</div>
	</div>
</form>

{{{ if needsAuthorization }}}
<div class="alert alert-warning">
Access Token and/or Refresh Token missing. Please click Authorize below.
</div>
{{{ end }}}

<button class="btn btn-primary" id="save">Save</button>
<button class="btn btn-success" id="authorize">Authorize</button>

<input id="csrf_token" type="hidden" value="{csrf}" />

<script type="text/javascript">
(async function () {
	var params = {};
	var queryString = location.hash.substring(1);
	var regex = /([^&=]+)=([^&]*)/g;
	var m;
	const alerts = await app.require('alerts');
	while (m = regex.exec(queryString)) {
		params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
	}

	if (params.access_token && params.refresh_token) {
		params.csrf_token = $('#csrf_token').val();
		$.post(config.relative_path + '/admin/plugins/imgur/tokens', params, function () {
			alerts.success('Authorized');
		});
	}

	$('#save').on('click', function() {
		var data = {
			csrf_token: $('#csrf_token').val(),
			imgurClientID: $('#imgurClientID').val(),
			imgurSecret: $('#imgurSecret').val(),
			albumID: $('#albumID').val()
		};

		$.post(config.relative_path + '/api/admin/plugins/imgur/save', data, function(data) {
			alerts.success(data.message);
		});

		return false;
	});

	$('#authorize').on('click', function() {
		var clientID = $('#imgurClientID').val();
		if (!clientID) {
			return alerts.error('[[error:no-imgur-client-id]]');
		}

		window.location = 'https://api.imgur.com/oauth2/authorize?client_id=' + clientID + '&response_type=token';
	});
}());
</script>

