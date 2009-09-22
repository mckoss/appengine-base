global_namespace.Define('startpad.format-util', function(NS) {

NS.Extend(NS, {
// Convert and digits in d to thousand-separated digits	
Thousands: function(d)
	{
	var s = d.toString();
	var sLast = "";
	while (s != sLast)
		{
		sLast = s;
		s = s.replace(/(\d+)(\d{3})/, "$1,$2");
		}
	return s;
	},
	
// Converts to lowercase, removes non-alpha chars and converts spaces to hyphens"
Slugify: function(s)
	{
	s = s.Trim().toLowerCase();
    s = s.replace(/[^\w\s-]/g, '-')
    	.replace(/[-\s]+/g, '-')
    	.replace(/(^-+)|(-+$)/g, '');
    return s;
	},

// Return an integer as a string using a fixed number of digits, c. (require a sign with fSign).
SDigits: function(val, c, fSign)
	{
	var s = "";
	var fNeg = (val < 0);

	if (fNeg)
		val = -val;
	
	val = Math.floor(val);
	
	for (; c > 0; c--)
		{
		s = (val%10) + s;
		val = Math.floor(val/10);
		}
		
	if (fSign || fNeg)
		s = (fNeg ? "-" : "+") + s;

	return s;
	},
	
EscapeHTML: function(s)
	{
	s = s.toString();
	s = s.replace(/&/g, '&amp;');
	s = s.replace(/</g, '&lt;');
	s = s.replace(/>/g, '&gt;');
	s = s.replace(/\"/g, '&quot;');
	s = s.replace(/'/g, '&#39;');
	return s;
	},
	
// Replace keys in dictionary of for {key} in the text string.
ReplaceKeys: function(st, keys)
	{
	for (var key in keys)
		st = st.StReplace("{" + key + "}", keys[key]);
	st = st.replace(/\{[^\{\}]*\}/g, "");
	return st;
	}

})

//--------------------------------------------------------------------------
// Some extensions to built-in JavaScript objects (sorry!)
//--------------------------------------------------------------------------

String.prototype.Trim = function()
{
	return (this || "").replace( /^\s+|\s+$/g, "");
};

String.prototype.StReplace = function(stPat, stRep)
{

	var st = "";

	var ich = 0;
	var ichFind = this.indexOf(stPat, 0);

	while (ichFind >= 0)
		{
		st += this.substring(ich, ichFind) + stRep;
		ich = ichFind + stPat.length;
		ichFind = this.indexOf(stPat, ich);
		}
	st += this.substring(ich);

	return st;
};

}); // startpad.format-util