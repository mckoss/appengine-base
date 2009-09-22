global_namespace.Define('startpad.date-util', function(NS) {
	var Base = NS.Import('startpad.base');
	var Format = NS.Import('startpad.format-util');

//--------------------------------------------------------------------------
// ISO 8601 Date Formatting
// YYYY-MM-DDTHH:MM:SS.sssZ (where Z could be +HH or -HH for non UTC)
// Note that dates are inherently stored at UTC dates internally.  But we infer that they
// denote local times by default.  If the dt.__tz exists, it is assumed to be an integer number
// of hours offset to the timezone for which the time is to be indicated (e.g., PST = -08).
// Callers should set dt.__tz = 0 to fix the date at UTC.  All other times are adjusted to
// designate the local timezone.
//--------------------------------------------------------------------------

NS.ISO = {
	tz: -(new Date().getTimezoneOffset())/60,  // Default timezone = local timezone
	enumMatch: new Base.Enum([1, "YYYY", "MM", "DD", 5, "hh", "mm", 8, "ss", 10, "sss", "tz"]),

FromDate: function(dt, fTime)
	{
	var dtT = new Date();
	dtT.setTime(dt.getTime());
	var tz = dt.__tz;
	if (tz == undefined)
		tz = NS.ISO.tz;

	// Adjust the internal (UTC) time to be the local timezone (add tz hours)
	// Note that setTime() and getTime() are always in (internal) UTC time.
	if (tz)
		dtT.setTime(dtT.getTime() + 60*60*1000 * tz);
	
	var s = dtT.getUTCFullYear() + "-" + Format.SDigits(dtT.getUTCMonth()+1,2) + "-" + Format.SDigits(dtT.getUTCDate(),2);
	var ms = dtT % (24*60*60*1000);
	if (ms || fTime || tz != 0)
		{
		s += "T" + Format.SDigits(dtT.getUTCHours(),2) + ":" + Format.SDigits(dtT.getUTCMinutes(),2);
		ms = ms % (60*1000);
		if (ms)
			s += ":" + Format.SDigits(dtT.getUTCSeconds(),2);
		if (ms % 1000)
			s += "." + Format.SDigits(dtT.getUTCMilliseconds(), 3);
		if (tz == 0)
			s += "Z";
		else
			s += Format.SDigits(tz, 2, true);
		}
	return s;
	},

//--------------------------------------------------------------------------
// Parser is more lenient than formatter.  Punctuation between date and time parts is optional.
// We require at the minimum, YYYY-MM-DD.  If a time is given, we require at least HH:MM.
// YYYY-MM-DDTHH:MM:SS.sssZ as well as YYYYMMDDTHHMMSS.sssZ are both acceptable.
// Note that YYYY-MM-DD is ambiguous.  Without a timezone indicator we don't know if this is a
// UTC midnight or Local midnight.  We default to UTC midnight (the FromDate function always
// write out non-UTC times so we can append the time zone).
// Fractional seconds can be from 0 to 6 digits (microseconds maximum)
//--------------------------------------------------------------------------
ToDate: function(sISO, objExtra)
	{
	var e = NS.ISO.enumMatch;
	var aParts = sISO.match(/^(\d{4})-?(\d\d)-?(\d\d)(T(\d\d):?(\d\d):?((\d\d)(\.(\d{0,6}))?)?(Z|[\+-]\d\d))?$/);
	if (!aParts)
		return undefined;

	aParts[e.mm] = aParts[e.mm] || 0;
	aParts[e.ss] = aParts[e.ss] || 0;
	aParts[e.sss] = aParts[e.sss] || 0;
	// Convert fractional seconds to milliseconds
	aParts[e.sss] = Math.round(+('0.'+aParts[e.sss])*1000);
	if (!aParts[e.tz] || aParts[e.tz] === "Z")
		aParts[e.tz] = 0;
	else
		aParts[e.tz] = parseInt(aParts[e.tz]);
	
	// Out of bounds checking - we don't check days of the month is correct!	
	if (aParts[e.MM] > 59 || aParts[e.DD] > 31 || aParts[e.hh] > 23 || aParts[e.mm] > 59 || aParts[e.ss] > 59 ||
		aParts[e.tz] < -23 || aParts[e.tz] > 23)
		return undefined;
	
	var dt = new Date();
	dt.setUTCFullYear(aParts[e.YYYY], aParts[e.MM]-1, aParts[e.DD]);
	if (aParts[e.hh])
		{
		dt.setUTCHours(aParts[e.hh], aParts[e.mm], aParts[e.ss], aParts[e.sss]);
		}
	else
		dt.setUTCHours(0,0,0,0);

	// BUG: For best compatibility - could set tz to undefined if it is our local tz
	// Correct time to UTC standard (utc = t - tz)
	dt.__tz = aParts[e.tz];
	if (aParts[e.tz])
		dt.setTime(dt.getTime() - dt.__tz * (60*60*1000));
	if (objExtra)
		NS.Extend(dt, objExtra);
	return dt;
	}
};  // NS.ISO
}); // startpad.date-util
