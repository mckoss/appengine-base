// Cookies can be quoted with "..." if they have spaces or other special characters.
// Internal quotes may be escaped with a \ character
// These routines use encodeURIComponent to safely encode and decode all special characters

global_namespace.Define('startpad.cookies', function(NS) {

NS.Extend(NS, {
SetCookie: function(name, value, days, fSecure)
	{
	var st = encodeURIComponent(name) + "=" + encodeURIComponent(value);
	if (days !== undefined)
		{
		st += ";max-age=" + days*60*60*24;
		}

	if (fSecure)
		{
		st += ";secure";
		}

	st += ";path=/";
	document.cookie = st;
	},

GetCookies: function()
	{
	var st = document.cookie;
	var rgPairs = st.split(";");
	
	var obj = {};
	for (var i = 0; i < rgPairs.length; i++)
		{
		// Note that document.cookie never returns ;max-age, ;secure, etc. - just name value pairs
		rgPairs[i] = rgPairs[i].Trim();
		var rgC = rgPairs[i].split("=");
		var val = decodeURIComponent(rgC[1]);
		// Remove quotes around value string if any (and also replaces \" with ")
		var rg = val.match('^"(.*)"$');
		if (rg)
			{
			val = rg[1].replace('\\"', '"');
			}
		obj[decodeURIComponent(rgC[0])] = val;
		}
	return obj;
	}
});});
