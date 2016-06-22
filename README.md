# NodeBB Plugin Imgur

A plugin that uploads images to Imgur.

## Installation

    npm install nodebb-plugin-imgur


## Setup

* Register an imgur app [here](https://api.imgur.com/oauth2/addclient), make sure you fill in the callback URL properly. It should be `http://yourforum.com/admin/plugins/imgur/oauth` adjust based on your forum url.
[![](http://i.imgur.com/neAKeeR.png)](http://i.imgur.com/neAKeeR.png)

* Once you register you will get a client ID and secret.
[![](http://i.imgur.com/haE9jzj.png)](http://i.imgur.com/haE9jzj.png)

* Enter these values in your NodeBB ACP page.
[![](http://i.imgur.com/p86s7lv.png)](http://i.imgur.com/p86s7lv.png)

* After entering the values click Save and then Authorize, you will be redirected to imgur to allow access to your app. 

* Once you allow access you will be redirected back to nodebb.

* Optinally create an album for your forum on imgur and put its album ID in the NodeBB ACP.





