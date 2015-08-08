<h1>Imgur</h1>


<form class="form">
	<div class="row">
		<div class="col-sm-6 col-xs-12">
			<div class="form-group">
				<label>Imgur Client ID</label>
				<input id="imgurClientID" type="text" class="form-control" placeholder="Enter Imgur Client ID" value="{settings.imgurClientID}">
			</div>
			<div class="form-group">
				<label>Imgur Secret</label>
				<input id="imgurSecret" type="text" class="form-control" placeholder="Enter Imgur Secret" value="{settings.imgurSecret}">
			</div>
			<div class="form-group">
				<label>Album ID</label>
				<input id="albumID" type="text" class="form-control" placeholder="Enter Album ID" value="{settings.albumID}">
			</div>
		</div>
	</div>
</form>

<button class="btn btn-primary" id="save">Save</button>
<button class="btn btn-success" id="authorize">Authorize</button>

<input id="csrf_token" type="hidden" value="{csrf}" />

<script type="text/javascript">


	$('#save').on('click', function() {
		var data = {
			_csrf: $('#csrf_token').val(),
			imgurClientID: $('#imgurClientID').val(),
			imgurSecret: $('#imgurSecret').val(),
			albumID: $('#albumID').val()
		};

		$.post(config.relative+relative_path + '/api/admin/plugins/imgur/save', data, function(data) {
			app.alertSuccess(data.message);
		});

		return false;
	});

	$('#authorize').on('click', function() {
		var clientID = $('#imgurClientID').val();
		if (!clientID) {
			return app.alertError('[[error:no-imgur-client-id]]');
		}

		window.location = 'https://api.imgur.com/oauth2/authorize?client_id=' + clientID + '&response_type=code';
	});
</script>

