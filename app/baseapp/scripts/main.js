// AppEngine-Base main.js
// Copyright (c) Seattle Google Technology Users Group

global_namespace.Define('seattle-gtug.appengine-base', function(NS) {
	var Base = NS.Import('startpad.base');

NS.Extend(NS, {
	sSiteName: "{{site_name}}",
	sTwitterSource: "{{twitter_source}}",
	sCSRF: "",
	apikey: undefined,
	msLoaded: Timer.MSNow(),
	msNow: null,
	
Init: function(sCSRF)
	{
	NS.sCSRF = sCSRF;
	},
	
FacebookShare: function(u, t)
	{
	window.open('http://www.facebook.com/sharer.php?u='+encodeURIComponent(u)+'&t='+encodeURIComponent(t),'sharer','toolbar=0,status=0,width=626,height=436');
	},

TweetThis: function(sPre, sPost)
	{
	// Truncate sPre so that sPre|sPost fits 140 characters
	var sText = sPre.substr(0, 140-sPost.length);
	window.open("http://twitter.com/home?source=" + NS.sTwitterSource +
		"&status=" +  encodeURIComponent(sText + sPost));
	}
	
});});