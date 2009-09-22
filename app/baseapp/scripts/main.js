// Quip-Art.com main.js - Image overlay service
// Copyright (c) Mike Koss (mckoss@startpad.org)

global_namespace.Define('quip-art', function(NS) {
	var Base = NS.Import('startpad.base');
	var DOM = NS.Import('startpad.DOM');
	var Vector = NS.Import('startpad.vector');
	var Timer = NS.Import('startpad.timer');
	var Events = NS.Import('startpad.events');
	var Data = NS.Import('startpad.data');
	var Cookies = NS.Import('startpad.cookies');
	var Sound = NS.Import('startpad.sound');

NS.Extend(NS, {
	sSiteName: "Quip-Art",
	sCSRF: "",
	apikey: undefined,
	msLoaded: Timer.MSNow(),
	msNow: null,
	msFrameLoaded: null,
	fInIdle: false,
	page: {},
	snd: null,
	fImageLoaded: false,
	fFrameLoaded: false,
	fSoundLoaded: false,
	fDisplayed: false,
	fDirty: false,
	
SetDirty: function()
	{
	if (!NS.page.is_owner)
		return;
	NS.fDirty = true;
	NS.msDirty = Timer.MSNow();
	},
	
ReadyOrTimeout: function(sFlag, msTimeout)
	{
	if (NS[sFlag])
		{
		return;
		}
	
	if (NS.msNow - NS.msLoaded > msTimeout)
		{
		console.warn(sFlag + " Timout");
		NS[sFlag] = true;
		}
	},
	
DisplayIfReady: function()
	{
	NS.msNow = Timer.MSNow();

	// If already displayed - just handle PostBack's
	if (NS.fDisplayed)
		{
		NS.PostBack();
		return;
		}
	
	NS.ReadyOrTimeout('fImageLoaded', 5000);
	NS.ReadyOrTimeout('fFrameLoaded', 5000);
	NS.ReadyOrTimeout('fSoundLoaded', 5000);
	
	if (!NS.fFrameLoaded || !NS.fImageLoaded || !NS.fSoundLoaded)
		return;
	
	if (!NS.msFrameLoaded)
		NS.msFrameLoaded = NS.msNow;
	
	// Wait for delay if any
	if (NS.msNow < NS.msFrameLoaded + NS.page.delay * 1000)
		{
		return;
		}

	NS.fDisplayed = true;
	
	var divOverlay = NS.parts['overlay-image'];
	DOM.SetSize(divOverlay, [NS.img.width, NS.img.height]);
	divOverlay.style.backgroundImage = "url(" + NS.img.src + ")";
	if (NS.page.has_text)
		{
		var txtEntry = NS.parts['overlay-text'];
		txtEntry.style.visibility = 'visible';
		NS.CheckFontSize();
		if (NS.page.is_owner)
			{
			txtEntry.focus();
			}
		}

	NS.OnResize();
	NS.parts['overlay-image'].style.visibility = 'visible';
	
	if (NS.snd)
		{
		NS.snd.Play();
		}
	},

Init: function(sCSRF)
	{
	NS.sCSRF = sCSRF;
	},
	
GoBuilder: function(id, sURL)
	{
	location.href = '/make-page?id=' + id + '&url='+encodeURIComponent(sURL);
	},
	
Moderate: function(id)
	{
	var chkAdult = document.getElementById('is_adult_' + id);
	var optStatus = document.getElementById('status_' + id);
	
	console.log("Adult: " + chkAdult.checked);
	console.log("Status: " + optStatus.value);
	
	sd = new Data.ScriptData('/moderate-overlay.json');
	sd.Call({csrf:NS.sCSRF, id:id, is_adult:chkAdult.checked, overlay_status:optStatus.value}, function (obj) {
		if (obj.status != 'OK')
			{
			alert("Moderation error: " + obj.message);
			return;
			}
		console.log(obj);
		window.location.reload();
		});
	},
	
ContinueToURL: function()
	{
	var mArgs = Data.ParseParams(location.href);
	console.log(mArgs);
	Cookies.SetCookie('adult-content-ok', true, 30);
	location.href = mArgs.url;
	},
	
Click: function()
	{
	NS.msLoaded = 0;
	},

	
// Called when overlay page is finished loading
PageLoaded: function(page)
	{
	NS.page = page;
	
	Data.SetSiteName(NS.sSiteName);

	window.onbeforeunload = NS.BeforeUnload;
	Events.AddEventFn(window, "click", NS.Click, true);
	
	// Update view count
	NS.Viewed();
	
	if (NS.page.snd)
		{
		Sound.Init({manager:NS.page.sound_player}, function () {
			if (Sound.fError)
				{
				NS.fSoundLoaded = true;
				NS.DisplayIfReady();
				return;
				}
			NS.snd = new Sound.Sound(NS.page.snd, function () {
				NS.fSoundLoaded = true;
				NS.DisplayIfReady();
				});
			});
		}
	else
		NS.fSoundLoaded = true;
	
	NS.parts = DOM.BindIDs();
	
	if (NS.page.has_text)
		{
		var divText = NS.parts['overlay-text'];
		if (NS.page.is_owner)
			{
			var ta = document.createElement('textarea');
			ta.id = 'overlay-text';
			ta.className = 'overlay-text';
			NS.parts['overlay-text'] = ta;
			ta.value = NS.page.sOverlay;
			divText.parentNode.replaceChild(ta, divText);
			Events.AddEventFn(ta, "change", NS.TextDirty);
			Events.AddEventFn(ta, "keyup", NS.TextDirty);
			}
		else
			{
			Events.DisableSelection(divText);
			}

		}
	
	NS.OnResize();

	Events.AddEventFn(window, "resize", NS.OnResize);
	
	// Don't set src until onload event is in place to ensure we catch it
	NS.img = new Image();
	Events.AddEventFn(NS.img, "load", function () {
		NS.fImageLoaded = true;
		NS.fDisplayed = false;
		NS.DisplayIfReady();
		});
	NS.img.src = NS.page.image_url.full;
	
	NS.DisplayIfReady();
	NS.tmIdle = new Timer.Timer(500, NS.DisplayIfReady).Repeat().Active();

	Events.Draggable(NS.parts["overlay-image"], function(dpt) {
		NS.parts['drag-background'].style.visibility = 'hidden';
		NS.page.dpt = NS.PositionImage(dpt);
		NS.OnResize();
		NS.SetDirty();
		}, {
			fInclusive:!NS.page.is_owner,
			fnStart: function()
				{
				// In case the image is adjusted - bring it up to date at time
				// of drag initiation.
				NS.page.dpt = NS.PositionImage();
				NS.parts['drag-background'].style.visibility = 'visible';
				},
			fnMove: function(dpt)
				{
				NS.PositionImage(dpt);
				}
			});
	},
	
IFrameLoaded: function()
	{
	NS.fFrameLoaded = true;
	},
	
TextDirty: function()
	{
	var sNew = NS.parts['overlay-text'].value;
	// Only take the first 500 characters from the textarea
	if (sNew.length > 500)
		{
		sNew = sNew.substr(0,500);
		NS.parts['overlay-text'].value = sNew;
		}
	if (sNew != NS.page.sOverlay)
		{
		NS.page.sOverlay = sNew;
		NS.SetDirty();
		
		NS.CheckFontSize();
		}
	},
	
BeforeUnload: function(evt)
	{
	var msUnloading = Timer.MSNow();
	
	if (NS.fDirty || msUnloading - NS.msLoaded < 5000)
		{
		evt = evt || window.event || {};
		if (NS.fDirty)
			evt.returnValue = "Click CANCEL to save your changes.";
		else
			evt.returnValue = "Click CANCEL to keep the " + NS.sSiteName + " window open.";
		return evt.returnValue;
		}
	},
	
OnResize: function()
	{
	var rcWindow = DOM.RcWindow();
	var dxMax = rcWindow[DOM.x2] - rcWindow[DOM.x];
	var dyMax = rcWindow[DOM.y2] - rcWindow[DOM.y];

	var divBar = NS.parts["quip-bar"];
	var dyBar = DOM.PtSize(divBar)[DOM.y];
	divBar.style.top = (dyMax - dyBar) + "px";
	// Account for size of ad and 4 px of padding on left and right
	// BUG: Firefox and Chrome seem to be displaying outside this box anyway???
	var dxCredits = Math.max(0,dxMax - 468 - 8);
	NS.parts['credits'].style.width = dxCredits + "px";
	dxCredits -= 125;
	if (NS.page.sound_player == 'entertonement')
		{
		dxCredits = Math.max(0, dxCredits - 330);
		}
	NS.parts['credits-block'].style.width = dxCredits + "px";
	
	var divContent = NS.parts["content"];
	var ptContent = DOM.PtClient(divContent);
	divContent.style.height = Math.max(0,dyMax - ptContent[DOM.y] - dyBar) + "px";
	
	NS.PositionImage();
	NS.CheckFontSize();
	},
	
PositionImage: function(dpt)
	{
	if (!dpt)
		dpt = [0,0];
	Vector.AddTo(dpt, NS.page.dpt);
	
	// Position the image if it's ready and loaded
	if (!NS.fImageLoaded)
		{
		return dpt;
		}
	
	var rcContent = DOM.RcClient(NS.parts["content"]);
	
	// Move the image to one of the 9 registration points in the layout
	var img = NS.parts["overlay-image"];
	var ptImageSize = [NS.img.width, NS.img.height];
	var rcImage = [0, 0, NS.img.width, NS.img.height];
	var iRef = NS.page.iReg;
	var ptTarget = Vector.PtRegistration(rcContent, iRef);
	var ptSource = Vector.PtRegistration(rcImage, iRef);
	var ptPos = Vector.Sub(ptTarget, ptSource);
	Vector.AddTo(ptPos, dpt);
	Vector.AddTo(rcImage, ptPos);
	
	// Ensure that at least 25% of the image is visible on the screen
	var rcContentExpanded = Vector.RcExpand(rcContent, Vector.Floor(Vector.Mult(ptImageSize, 0.75)));
	var ptAdjust = Vector.UL(rcImage);
	Vector.KeepInRect(rcImage, rcContentExpanded);
	Vector.SubFrom(ptAdjust, Vector.UL(rcImage));

	var rcClipped = Vector.RcClipToRect(rcImage, rcContent);
	var dptOffset = Vector.Sub(Vector.UL(rcClipped), Vector.UL(rcImage));
	img.style.backgroundPosition = -dptOffset[0] + "px " + -dptOffset[1] + "px";
	DOM.SetRc(img, rcClipped);
	if (NS.rcTextAdjusted)
		{
		var rcTextT = Vector.Sub(NS.rcTextAdjusted, dptOffset);
		DOM.SetRc(NS.parts['overlay-text'], rcTextT);
		}
	
	return Vector.Sub(dpt, ptAdjust);
	},
	
// If the user is the owner of the link, post back any edits made to the Layout
asPostBack: ['csrf', 'id', 'dpt', 'sOverlay', 'iReg'],
PostBack: function()
	{
	if (NS.fDirty)
		{
		// Don't save until the user settles down for a few seconds
		if (NS.msNow - NS.msDirty < 3000)
			return;
		NS.page.csrf = NS.sCSRF;
		NS.fDirty = false;
		var sd = new Data.ScriptData('/edit-page.json');
		sd.Call(Base.Project(NS.page, NS.asPostBack), function(obj) {
			if (obj.status != 'OK')
				{
				alert("Error modifying page.  " + obj.message);
				return;
				}
			NS.page = obj.page;
			});
		}
	},
	
CheckFontSize: function()
	{
	if (!NS.page.has_text)
		return;

	var divMeasure = NS.parts['overlay-measure'];
	var spanMeasure = NS.parts['span-measure'];
	var ptAvailable = Vector.Size(NS.page.rcText);
	// HACK: It seems that width of a div display has two pixels less room than
	// the textarea?  Even if not, this will be conservative of the available room.
	divMeasure.style.width = (ptAvailable[Vector.x]-2) + "px";
	
	// Empty text case measures an empty box - don't do that.
	var sText = NS.page.sOverlay;
	if (sText == "")
		sText = ".";
	DOM.SetText(spanMeasure, sText);
	
	var aSizes = [120, 96, 72, 48, 36, 24, 18, 12, 10, 8, 6];
	var sSize;
	var ptSize;
	var size;
	for (var i = 0; i < aSizes.length; i++)
		{
		size = aSizes[i];
		sSize = aSizes[i] + "px";
		divMeasure.style.fontSize = sSize;
		ptSize = DOM.PtSize(divMeasure);
		ptSpanSize = DOM.PtSize(spanMeasure);
		if (ptSize[Vector.y] <= ptAvailable[Vector.y] && ptSpanSize[Vector.x] <= ptAvailable[Vector.x])
			break;
		}
	
	if (sSize != NS.sSizeLast || ptSize[Vector.y] != NS.ptSizeLast[Vector.y])
		{
		NS.sSizeLast = sSize;
		NS.ptSizeLast = ptSize;
		NS.parts['overlay-text'].style.fontSize = sSize;
		
		// IE 8 Bug! - reset the text to force render!
		if (Base.Browser.fIE)
			NS.parts['overlay-text'].value = NS.page.sOverlay;
		
		NS.rcTextAdjusted = Vector.Add(NS.page.rcText, [0, (ptAvailable[Vector.y]-NS.ptSizeLast[Vector.y])/2]);
		DOM.SetRc(NS.parts['overlay-text'], NS.rcTextAdjusted);
		}
	},
	
Viewed: function()
	{
	var sd = new Data.ScriptData('/view-page.json');
	sd.Call(Base.Project(NS.page, ["id"]));
	},
	
TrackEvent: function(sEvent)
	{
	try
		{
		pageTracker._trackPageview('/meta/' + sEvent);
		}
	catch (e) {}
	},
	
FacebookShare: function(u, t)
	{
	window.open('http://www.facebook.com/sharer.php?u='+encodeURIComponent(u)+'&t='+encodeURIComponent(t),'sharer','toolbar=0,status=0,width=626,height=436');
	},
	
TweetThis: function()
	{
	var sSuffix = " - http://" + window.location.host + "/" + NS.page.id;
	var sText = NS.page.sOverlay.substr(0, 140-sSuffix.length);
	window.open("http://twitter.com/home?source=" + NS.page.sTwitterSource +
		"&status=" +  encodeURIComponent(sText + sSuffix));
	}
	
});});