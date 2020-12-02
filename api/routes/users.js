var express = require('express');
var router = express.Router();

var key = process.env.CROWNSTONE_GUEST_KEY;

/* GET users listing. */
router.get('/', function(req, res, next) {
	console.log("Show key (should be kept private):", key);
	let user = new Object();
	user.key = key;
	res.send(JSON.stringify(user));
});

module.exports = router;
