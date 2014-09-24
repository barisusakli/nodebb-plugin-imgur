<h1>Imgur</h1>


<form class="form">
	<div class="row">
		<div class="col-sm-4 col-xs-12">
			<div class="form-group">
				<label>Imgur Client ID</label>
				<input id="imgurClientID" type="text" class="form-control" placeholder="Enter Imgur Client ID" value="{imgurClientID}">
			</div>
		</div>
	</div>
</form>

<button class="btn btn-primary" id="save">Save</button>

<input id="csrf_token" type="hidden" value="{csrf}" />

<script type="text/javascript">


	$('#save').on('click', function() {

		$.post('/api/admin/plugins/imgur/save', {_csrf : $('#csrf_token').val(), imgurClientID : $('#imgurClientID').val()}, function(data) {
			app.alertSuccess(data.message);
		});

		return false;
	});

</script>