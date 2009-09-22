// unit.js - Unit testing framework
// Copyright (c) 2007-2008, Mike Koss (mckoss@startpad.org)
//
// Usage:
// ts = new UT.TestSuite("Suite Name");
// ts.DWOutputDiv();
// ts.AddTest("Test Name", function(ut) { ... ut.Assert() ... });
// ...
// ts.Run();
// ts.Report();
//
// Requires: base.js, timer.js

// UnitTest - Each unit test calls a function which in turn calls
// back Assert's on the unit test object.

Function.prototype.FnMethod = function(obj)
{
	var _fn = this;
	return function () { return _fn.apply(obj, arguments); };
};

Function.prototype.FnArgs = function()
{
	var _fn = this;
	var _args = [];
	for (var i = 0; i < arguments.length; i++)
		_args.push(arguments[i]);

	return function () {
		var args = [];
		// In case this is a method call, preserve the "this" variable
		var self = this;

		for (var i = 0; i < arguments.length; i++)
			args.push(arguments[i]);
		for (i = 0; i < _args.length; i++)
			args.push(_args[i]);

		return _fn.apply(self, args);
	};	
};

var UT = {

// Extend(dest, src1, src2, ... )
// Shallow copy properties in turn into dest object
Extend: function(dest)
	{
	for (var i = 1; i < arguments.length; i++)
		{
		var src = arguments[i];
		for (var prop in src)
			{
			if (src.hasOwnProperty(prop))
				dest[prop] = src[prop];
			}
		}
	},

DW: function(st) {document.write(st);},

Browser:
	{
	version: parseInt(navigator.appVersion),
	fIE: navigator.appName.indexOf("Microsoft") != -1
	},
	
// Convert all top-level object properties into a URL query string.
// {a:1, b:"hello, world"} -> "?a=1&b=hello%2C%20world"
StParams: function(obj)
	{
	if (obj == undefined || obj == null)
		return "";
		
	var stDelim = "?";
	var stParams = "";
	for (var prop in obj)
		{
		if (!obj.hasOwnProperty(prop) || prop == "_anchor")
			continue;
		stParams += stDelim;
		stParams += encodeURIComponent(prop);
		// BUG: This is a bit bogus to encode a query param in JSON
		if (typeof obj[prop] == "object")
			stParams += "=" + encodeURIComponent(PF.EncodeJSON(obj[prop], true));
		else if (obj[prop] != null)
			stParams += "=" + encodeURIComponent(obj[prop]);
		stDelim = "&";
		}
	if (obj._anchor)
		stParams += "#" + encodeURIComponent(obj._anchor);
	return stParams;
	}
};  // UT

UT.Timer = function(fnCallback, ms)
{
	this.ms = ms;
	this.fnCallback = fnCallback;
	return this;
};

UT.Timer.prototype = {
	constructor: UT.Timer,
	fActive: false,
	fRepeat: false,
	fInCallback: false,
	fReschedule: false,

Repeat: function(f)
{
	if (f == undefined)
		f = true;
	this.fRepeat = f;
	return this;
},

Ping: function()
{
	// In case of race condition - don't call function if deactivated
	if (!this.fActive)
		return;

	// Eliminate re-entrancy - is this possible?
	if (this.fInCallback)
		{
		this.fReschedule = true;
		return;
		}

	this.fInCallback = true;
	this.fnCallback();
	this.fInCallback = false;

	if (this.fActive && (this.fRepeat || this.fReschedule))
		this.Active(true);
},

// Calling Active resets the timer so that next call to Ping will be in this.ms milliseconds from NOW
Active: function(fActive)
{
	if (fActive == undefined)
		fActive = true;
	this.fActive = fActive;
	this.fReschedule = false;

	if (this.iTimer)
		{
		clearTimeout(this.iTimer);
		this.iTimer = undefined;
		}

	if (fActive)
		this.iTimer = setTimeout(this.Ping.FnMethod(this), this.ms);

	return this;
}
}; // UT.Timer

UT.ScriptData = function(stURL)
{
    this.stURL = stURL;
    return this;
};

UT.ScriptData.ActiveCalls = [];
UT.ScriptData.ridNext = 1;
UT.ScriptData.stMsg = {
    errBusy: "Call made while another call is in progress.",
    errUnmatched: "Callback received for inactive call: ",
    errTimeout: "Server did not respond before timeout."
    };

UT.ScriptData.prototype = {
	constructor:UT.ScriptData,
	rid: 0,
	msTimeout: 2000, 

Call: function(objParams, fnCallback)
	{
    if (this.rid != 0)
        throw(new Error(UT.ScriptData.stMsg.errBusy));

	this.fResponse = false;
	this.objResponse = undefined;
	this.ridResponse = 0;
   	this.rid = UT.ScriptData.ridNext++;
    UT.ScriptData.ActiveCalls[this.rid] = this;

	if (fnCallback)
		this.fnCallback = fnCallback;
            
    if (objParams === undefined)
            objParams = {};
    objParams.callback = "UT.ScriptData.ActiveCalls[" + this.rid + "].Callback";
    this.script = document.createElement("script");
    this.script.src = this.stURL + UT.StParams(objParams);
    this.tm = new UT.Timer(this.Timeout.FnMethod(this), this.msTimeout).Active(true);
    document.body.appendChild(this.script);
    console.log("script[" + this.rid + "]: " + this.script.src);
    return this;
	},
	
Callback: function()
	{
	// Ignore callbacks for canceled/timed out or old calls
	this.fResponse = true;
	var rid = this.rid;
    this.Cancel();
    console.log("(" + rid + ") -> ", arguments);
    this.fnCallback.apply(undefined, arguments);
	},
	
Timeout: function()
	{
	var rid = this.rid;
	this.Cancel();
    console.log("(" + rid + ") -> TIMEOUT");
    this.fnCallback({status:"Fail/Timeout"});
	},
	
// ScriptData can be re-used once complete
Cancel: function()
	{
	UT.ScriptData.Cancel(this.rid);
	}
}; //UT.ScriptData

UT.ScriptData.Cancel = function(rid)
{
	if (rid == 0)
		return;
	var sd = UT.ScriptData.ActiveCalls[rid];
	UT.ScriptData.ActiveCalls[rid] = undefined;
	// Guard against multiple calls to Cancel (after sd may be reused)
	if (sd && sd.rid == rid)
		{
		sd.rid = 0;
		sd.tm.Active(false);
		}
};


UT.UnitTest = function (stName, fn)
{
    this.stName = stName;
    this.fn = fn;
    this.rgres = [];
};

UT.UnitTest.states = {
    created: 0,
    running: 1,
    completed: 2
};

UT.UnitTest.prototype = {
constructor: UT.UnitTest,
    state: UT.UnitTest.states.created,
    cErrors: 0,
    cErrorsExpected: 0,
    cAsserts: 0,
    fEnable: true,
    cAsync: 0,
    fThrows: false,
    cThrows: 0,
    msTimeout: 10000,
    stTrace: "",
    cBreakOn: 0,
    fStopFail: false,

Run: function(ts)
    {
    var fCaught = false;

    if (!this.fEnable)
        return;
    this.state = UT.UnitTest.states.running;

    if (this.cAsync)
        this.tm = new UT.Timer(this.Timeout.FnMethod(this), this.msTimeout).Active();

    try
        {
        this.fn(this);
        }
    catch (e)
        {
        fCaught = true;
        this.fStopFail = false;		// Avoid recursive asserts
        this.e = e;
        this.Async(0)
        this.AssertException(this.e, this.stThrows, this.fThrows);
        }
    
    if (this.fThrows && !fCaught)
        this.Assert(false, "Missing expected Exception: " + this.stThrows);

    if (!this.cAsync)
        this.state = UT.UnitTest.states.completed;
    },
    
IsComplete: function()
    {
    return !this.fEnable || this.state == UT.UnitTest.states.completed;
    },

AssertThrown: function()
    {
    this.AssertGT(this.cThrows, 0, "Expected exceptions not thrown.");
    this.cThrows = 0;
    },

Enable: function(f)
    {
    this.fEnable = f;
    return this;
    },
    
StopFail: function(f)
	{
	this.fStopFail = f;
	return this;
	},

// Change expected number async events running - test is finishd at 0.
// Async(false) -> -1
// Async(true) -> +1
// Async(0) -> set cAsync to zero
// Async(c) -> +c
// TODO: Could use Expected number of calls to Assert to terminate an async test
// instead of relying on the cAsync count going to zero.
Async: function(dc, msTimeout)
    {
    if (dc == undefined || dc === true)
        dc = 1;
    if (dc === false)
    	dc = -1;
    if (msTimeout)
    	{
		// Don't call assert unless we have a failure - would mess up user counts for numbers
		// of Asserts expected.
    	if (this.cAsync != 0 || this.state == UT.UnitTest.states.running)
    		this.Assert(false, "Test error: Async timeout only allowed at test initialization.");
    	this.msTimeout = msTimeout;
    	}
    if (dc == 0)
    	this.cAsync = 0;
    else
	    this.cAsync += dc;
    if (this.cAsync < 0)
    	{
		this.Assert(false, "Test error: unbalanced calls to Async")
		this.cAsync = 0;    	
    	}

	// When cAsync goes to zero, the aynchronous test is complete
    if (this.cAsync == 0 && this.state == UT.UnitTest.states.running)
        this.state = UT.UnitTest.states.completed;
        
    this.CheckValid();
    return this;
    },
    
Timeout: function()
{
    if (this.cAsync > 0)
        {
        this.fStopFail = false;
        this.Async(0);
        this.Assert(false, "Async test timed out.");
        }
},

Throws: function(stThrows)
    {
    this.fThrows = true;
    this.stThrows = stThrows;
    this.CheckValid();
    return this;
    },

Expect: function(cErrors, cTests)
    {
    this.cErrorsExpected = cErrors;
    this.cTestsExpected = cTests;
    return this;
    },

CheckValid: function()
    {
    if (this.cAsync > 0 && this.fThrows)
        this.Assert(false, "Test error: can't test async thrown exceptions.");
    },
    
Reference: function(url)
    {
    this.urlRef = url;
    return this;
    },

// All asserts bottleneck to this function
// Eror line pattern "N. [Trace] Note (Note2)"
Assert: function(f, stNote, stNote2)
    {
    // TODO: is there a way to get line numbers out of the callers?
    // A backtrace (outside of unit.js) would be the best way to designate
    // the location of failing asserts.
    if (this.stTrace)
    	stNote = (this.cAsserts+1) + ". [" + this.stTrace + "] " + stNote;
    else
    	stNote = (this.cAsserts+1) + ". " + stNote;

    if (stNote2)
    	stNote += " (" + stNote2 + ")";
    	
    // Allow the user to set a breakpoint when we hit a particular failing test
    if (!f && (this.cBreakOn == -1 || this.cBreakOn == this.cAsserts+1))
    		this.Breakpoint(stNote);
    
    var res = new UT.TestResult(f, this, stNote);
    this.rgres.push(res);
    if (!res.f)
        this.cErrors++;
    this.cAsserts++;
    // We don't throw an exception on StopFail if we already have thrown one!
    if (this.fStopFail && this.cErrors > this.cErrorsExpected && !this.e)
    	{
    	this.fStopFail = false;
    	this.Async(0);
    	throw new Error("StopFail - test terminates on first (unexpected) failure.");
    	}
    },
    
Trace: function(stTrace)
	{
	this.stTrace = stTrace;
	},
	
BreakOn: function(cBreakOn)
	{
	this.cBreakOn = cBreakOn;
	},
	
// Set Firebug breakpoint in this function
Breakpoint: function(stNote)
	{
	console.log("unit.js Breakpoint: [" + this.stName + "] " + stNote);
	// Set Firebug breakpoint on this line:
	var x = 1;
	},

AssertEval: function(stEval)
    {
    this.Assert(eval(stEval), stEval);
    },

// v1 is the quantity to be tested against the "known" quantity, v2.
AssertEq: function(v1, v2, stNote)
    {
    if (typeof v1 != typeof v2)
    	{
    	this.Assert(false, "Comparing values of different type: " + typeof v1 + ", " + typeof v2, stNote);
    	return;
    	}
    	
    switch (typeof v1)
    	{
    case "string":
    	pos = "";
    	if (v1 != v2)
    		for (var i = 0; i < v2.length; i++)
    			{
    			if (v1[i] != v2[i])
    				{
    				pos += "@" + i + " x" + v1.charCodeAt(i).toString(16) + " != x" + v2.charCodeAt(i).toString(16) + ", "
					break;    				
    				}
    			}
        this.Assert(v1 == v2, "\"" + v1 + "\" == \"" + v2 + "\" (" + pos + "len: " + v1.length + ", " + v2.length + ")", stNote);
        break;

    case "object":
        this.AssertContains(v1, v2);
	    var cProp1 = this.PropCount(v1);
	    var cProp2 = this.PropCount(v2);
	    this.Assert(cProp1 == cProp2, "Objects have different property counts (" + cProp1 + " != " + cProp2 + ")");
	    
	    // Make sure Dates match
	    if (v1.constructor == Date)
	    	{
		    this.AssertEq(v2.constructor, Date);   	
	    	if (v2.constructor == Date)
	    		this.AssertEq(v1.toString(), v2.toString());
	    	}
	    break;
    default:
        this.Assert(v1 == v2, v1 + " == " + v2 + " (type: " + typeof v1 + ")", stNote);
        break;
    	}
    },

PropCount: function(obj)
    {
    var cProp = 0;
    for (var prop in obj)
        {
        if (obj.hasOwnProperty(prop))
            cProp++;
        }
    return cProp;
    },
    
AssertType: function(v1, type, stNote)
	{
	if (typeof type == "function")
		{
		this.AssertEq(typeof v1, "object", stNote);
		this.Assert(v1 instanceof type, stNote, "incorrect instance");
		return;
		}
	this.AssertEq(typeof v1, type);
	},

// Assert that objAll contains all the (top level) properties of objSome
AssertContains: function(objAll, objSome)
    {
    if (typeof objAll != "object" || typeof objSome != "object")
        {
        this.Assert(false, "AssertContains expects objects: " + typeof objAll + " ~ " + typeof objSome);
        return;
        }
    
    // For arrays, just confirm that the elements of the 2nd array are included as members of the first    
    if (objSome instanceof Array)
    	{
    	if (!(objAll instanceof Array))
    		{
    		this.Assert(false, "AssertContains unmatched Array: " + objAll.constructor);
    		return;
    		}
    		
    	var map1 = {}
    	for (var prop in objAll)
    		map1[objAll[prop]] = true;
    	
    	for (var prop in objSome)
    		this.Assert(map1[objSome[prop]], "Missing array value: " + objSome[prop] +
    			" (type: " + typeof(objSome[prop]) + ")");
    		
    	return;
    	}

    for (var prop in objSome)
        {
        if (!objSome.hasOwnProperty(prop))
            continue;
        this.AssertEq(objAll[prop], objSome[prop], "prop: " + prop);
        }
    },
    
AssertIdent: function(v1, v2)
    {
    this.Assert(v1 === v2, v1 + " === " + v2);
    },

AssertNEq: function(v1, v2)
    {
    this.Assert(v1 != v2, v1 + " != " + v2);
    },

AssertGT: function(v1, v2)
    {
    this.Assert(v1 > v2, v1 + " > " + v2);
    },
    
AssertLT: function(v1, v2)
	{
	this.Assert(v1 < v2, v1 + " < " + v2);
	},

AssertFn: function(fn)
    {
    var stFn = fn.toString();
    stFn = stFn.substring(stFn.indexOf("{")+1, stFn.lastIndexOf("}")-1);
    this.Assert(fn(), stFn);
    },
    
// Useage: ut.AssertThrows(<type>, function(ut) {...});
AssertThrows: function(stExpected, fn)
	{
	try
		{
		fn(this);
		}
	catch (e)
		{
		this.AssertException(e, stExpected);
		return;
		}
    this.Assert(false, "Missing expected Exception: " + stExpected);
	},

// Assert expected and caught exceptions
// If stExpected != undefined, e.name or e.message must contain it
AssertException: function(e, stExpected, fExpected)
    {
    if (fExpected == undefined) fExpected = true;
    
    if (fExpected)
    	{
	    if (e.name) e.name = e.name.toLowerCase();
	    if (e.message) e.message = e.message.toLowerCase();
	    if (stExpected) stExpected = stExpected.toLowerCase();
	    this.Assert(!stExpected || e.name.indexOf(stExpected) != -1 ||
	        e.message.indexOf(stExpected) != -1,
	        "Exception: " + e.name + " (" + e.message + ")" +
	        (stExpected ? " Expecting: " + stExpected : ""));
	    this.cThrows++;
    	}
    else
    	{
	    var stMsg = "Exception: " + e.name + " (" + e.message;
	    if (e.number != undefined)
	        stMsg += ", Error No:" + (e.number & 0xFFFF);
	    stMsg += ")";
	    if (e.lineNumber != undefined)
	        stMsg += " @ line " + e.lineNumber;
	    this.Assert(false, stMsg);
    	}
	},

// AsyncSequence - Run a sequence of asynchronous function calls
// Each fn(ut) must call ut.NextFn() to advance
// Last call to NextFn calls Async(false)
AsyncSequence: function(rgfn)
{
	this.rgfn = rgfn;
	this.ifn = 0;
	this.NextFn();
},

NextFn: function()
	{
	if (this.ifn >= this.rgfn.length)
		{
		this.Async(false);
		return;
		}
	this.Trace("AsyncSeq: " + (this.ifn+1));
	try
		{
		this.rgfn[this.ifn++](this);
		}
	catch (e)
		{
		this.AssertException(e, "", false)
		}
	},

// Wrap asynchronous function calls so we can catch are report exception errors	
FnWrap: function(fn)
	{
	var ut = this;

	return (
		function () {
			try
				{
				fn.apply(undefined, arguments);
				}
			catch (e)
				{
				ut.AssertException(e, "", false);
				// Advance to next function in sequence
				ut.NextFn();
				}
		});
	}
}; // UT.UnitTest

// TestResult - a single result from the test

UT.TestResult = function (f, ut, stNote)
{
    this.f = f;
    this.ut = ut;
    this.stNote = stNote;
};

// ------------------------------------------------------------------------
// Test Suite - Holds, executes, and reports on a collection of unit tests.
// ------------------------------------------------------------------------

UT.TestSuite = function (stName)
{
    this.stName = stName;
    this.rgut = [];
    this.stOut = "";
};


UT.TestSuite.prototype = {
constructor: UT.TestSuite,
    cFailures: 0,
    iReport: -1,
    fStopFail: false,
    fTerminateAll: false,
    iutNext: 0,				// Will auto-disable any unit test less than iutNext (see SkipTo)

AddTest: function(stName, fn)
    {
    var ut = new UT.UnitTest(stName, fn);
    this.rgut.push(ut);
    
    // Global setting - stop all unit tests on first failure.
    if (this.fStopFail)
    	ut.StopFail(true)

    return ut;  
    },
    
StopFail: function(f)
	{
	this.fStopFail = f;
	return this;
	},
	
SkipTo: function(iut)
	{
	// Tests displayed as one-based
	this.iutNext = iut-1;
	return this;
	},

// We support asynchronous tests - so we use a timer to kick off tests when the current one
// is complete.
Run: function()
    {
    // BUG: should this be Active(false) - since we do first iteration immediately?
    this.tmRun = new UT.Timer(this.RunNext.FnMethod(this), 100).Repeat().Active(true);

    this.iCur = 0;
    // Don't wait for timer - start right away.
    this.RunNext();
    },
    
RunNext: function()
    {
    if (this.iCur == this.rgut.length)
        return;

    this.tmRun.Active(false);
loop:
    while (this.iCur < this.rgut.length)
        {
        var ut = this.rgut[this.iCur];
        var state = ut.state;
        if (!ut.fEnable || this.fTerminateAll || this.iCur < this.iutNext)
            state = UT.UnitTest.states.completed;
        switch(state)
            {
        case UT.UnitTest.states.created:
            ut.Run();
            break;
        case UT.UnitTest.states.running:
            break loop;
        case UT.UnitTest.states.completed:
            this.iCur++;
            this.ReportWhenReady();
            // Skip all remaining tests on failure if StopFail
            if (this.fStopFail && ut.cErrors != ut.cErrorsExpected)
            	this.fTerminateAll = true;
            break;
            }
        }
    this.tmRun.Active(true);
    },

AllComplete: function()
    {
    return (this.iCur == this.rgut.length);
    },
    
DWOutputDiv: function()
    {
    UT.DW("<DIV style=\"font-family: Courier;border:1px solid red;\" id=\"divUnit\">Unit Test Output</DIV>");
    },

Out: function(st)
    {
    this.stOut += st;
    return this;
    },
    
OutRef: function(st, url)
    {
    if (!url)
        {
        this.Out(st);
        return;
        }
    if (this.divOut)
        this.Out("<A target=\"_blank\" href=\"" + url + "\">" + st + "</A>");
    else
        {
        if (st != url)
            this.Out(st + " (" + url + ")");
        else
            this.Out(st);
        }
    },

NL: function()
    {
    if (this.divOut)
        {
        this.divOut.appendChild(document.createElement("BR"));
        var txt = document.createElement("span");
        txt.innerHTML = this.stOut;
        this.divOut.appendChild(txt);
        }
    else if (typeof console != "undefined")
        console.log(this.stOut);
    else
        alert(this.stOut);
    this.stOut = "";
    return this;
    },

Report: function()
    {
    this.divOut = this.divOut || document.getElementById("divUnit");    
    this.cFailures = 0;
    this.iReport = 0;
    this.ReportWhenReady();
    },

ReportWhenReady: function()
    {
    // Reporting not enabled
    if (this.iReport == -1)
        return;
    while (this.iReport < this.iCur)
        this.ReportOne(this.iReport++);
    
    if (!this.AllComplete())
        return;

    this.ReportSummary();
    this.ReportOut();
    },

ReportOne: function(i)
    {
    var ut = this.rgut[i];
    this.Out((i+1) + ". ");

    switch (ut.state)
        {
    case UT.UnitTest.states.created:
        this.Out("N/A");
        break;
    case UT.UnitTest.states.running:
        if (ut.cAsync > 0)
            this.Out("RUNNING");
        else
            {
            this.Out("INCOMPLETE");
            }
        this.cFailures++;
        break;
    case UT.UnitTest.states.completed:
        if (ut.cErrors == ut.cErrorsExpected &&
            (ut.cTestsExpected == undefined || ut.cTestsExpected == ut.cAsserts))
            this.Out("PASS");
        else
            {
            this.Out("FAIL");
            this.cFailures++;
            }
        break;
        }

    this.Out(" [");
    this.OutRef(ut.stName, ut.urlRef);
    this.Out("] ");

    if (ut.state != UT.UnitTest.states.created)
        {
        this.Out(ut.cErrors + " errors " + "out of " + ut.cAsserts + " tests");
        if (ut.cTestsExpected && ut.cTestsExpected != ut.cAsserts)
            this.Out(" (" + ut.cTestsExpected + " expected)");
        }
    this.NL();

    for (var j = 0; j < ut.rgres.length; j++)
        {
        var res = ut.rgres[j];
        if (!res.f)
            this.Out("Failed: " + res.stNote).NL();
        }
    },
    
ReportSummary: function()
    {
    if (this.cFailures == 0)
        this.Out("Summary: All (" + this.rgut.length + ") tests pass.").NL();
    else        
        this.Out("Summary: " + this.cFailures + " failures out of " + this.rgut.length + " tests.").NL();
    },

// Report results to master unit test, if any.
ReportOut: function()
    {
    if (!this.AllComplete())
        return;
    if (window.opener && window.opener.MasterTest)
        {
        var iUnit = parseInt(window.name.replace(/^Unit_/, ""));
        window.opener.MasterTest(iUnit, this.cFailures, this.rgut.length);
        }
    },
    
AddSubTest: function(stPath)
    {
    var ut = this.AddTest(stPath, this.RunSubTest.FnMethod(this)).Async(true).Reference(stPath);
    ut.stPath = stPath;
    ut.iUnit = this.rgut.length-1;
    return ut;
    },
    
RunSubTest: function(ut)
    {
    var stName = "Unit_" + ut.iUnit;
    // Ensure unique name even if multi-level of master-child tests.
    if (window.name)
        stName += " from " + window.name;
    ut.win = window.open(ut.stPath, "Unit_" + ut.iUnit);
    if (window.MasterTest == undefined)
        window.MasterTest = this.MasterTest.FnMethod(this);
    },
    
MasterTest: function(iUnit, cErrors, cTests)
    {
    var ut = this.rgut[iUnit];
    ut.cErrors = cErrors;
    ut.cAsserts = cTests;
    ut.Async(false);
    if (ut.cErrors == ut.cErrorsExpected)
        ut.win.close();
    }
};
