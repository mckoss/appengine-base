from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.template import loader, RequestContext

from django.shortcuts import render_to_response
from django.conf.urls.defaults import patterns
from google.appengine.api import memcache
from google.appengine.api import users
from django.utils.cache import patch_response_headers

from hashlib import sha1
import re
import random
from datetime import datetime
import settings
import logging
import traceback
import sys
import simplejson
import globals
import threading
import urllib
import os

def JSONUrls():
    return patterns('',
        # API handlers
        (r'^init.json$', InitAPI),
        (r'^get-result.json$', GetResult),
        (r'^loopback-test.json$', Loopback),
    )

"""
Signed and verified strings can only come from the server
"""

def SSign(req, type, s, sSecret=None):
    # Sign the string using the server secret key
    # type is a short string that is used to distinguish one type of signed content vs. another
    # (e.g. user auth from).
    if sSecret is None:
        sSecret = req.sSecret
    hash = sha1('~'.join((type, str(s), sSecret))).hexdigest().upper()
    return '~'.join((type, str(s), hash))

regSigned = re.compile(r"^([\w-]+)~(.*)~[0-9A-F]{40}$")

def SGetSigned(req, type, s, sSecret=None, sError="Failed Authentication"):
    # Raise exception if s is not a valid signed string of the correct type.  Returns
    # original (unsigned) string if succeeds.
    try:
        m = regSigned.match(s)
        if type == m.group(1) and SSign(req, type, m.group(2), sSecret) == s:
            return m.group(2)
    except:
        pass

    if m and s != '' and type == m.group(1):
        logging.warning("Signed failure: %s: %s" % (type, s))

    raise Error(sError, 'Fail/Auth/%s' % type)

"""
Exception classes
"""
class Error(Exception):
    # Default Error exception
    def __init__(self, message, status='Fail', obj=None):
        if obj == None:
            obj = {}
        if not 'status' in obj:
            obj['status'] = status
        obj['message'] = message
        self.obj = obj
        
class DirectResponse(Exception):
    def __init__(self, resp):
        self.resp = resp        

def RaiseNotFound(req):
    raise Error("The %s page, %s%s, does not exist." % (settings.sSiteName, req.sHost, req.path), obj={'path':req.path, 'status':'Fail/NotFound'})

def RaiseNYI(req):
    raise Error("Not yet implemented.")
"""
Django request filter middle-ware
"""
regJSON = re.compile(r".*\.json$")
regRSS = re.compile(r".*\.rss$")

class ReqFilter(object):
    def process_request(self, req):
        local.req = req

        req.mCookies = {}
        req.mResponse = {}
        req.mAllow = set()
        req.ipAddress = req.META['REMOTE_ADDR']
        req.sHost = "http://%s" % req.META["HTTP_HOST"]
        req.dtNow = datetime.now()
        req.sSecret = globals.Globals.SGet(settings.sSecretName, "test server key")
        req.secsCache = 3600
        
        def Require_Closure(*sKeys):
            return Require(req, *sKeys)
        def FOnce_Closure(sKey):
            return FOnce(req, sKey)
        def FAllow_Closure(*sKeys):
            return FAllow(req, *sKeys)
        def AddToResponse_Closure(m):
            AddToResponse(req, m)
        def SetCacheTime_Closure(secs):
            SetCacheTime(req, secs)
        class ResponseTime(object):
            # Object looks like a string object - evaluates with time since start of request
            def __str__(self):
                ddt = datetime.now() - req.dtNow 
                sec = ddt.seconds + float(ddt.microseconds)/1000000
                return "%1.2f" % sec
            
        req.sResponseTime = ResponseTime()
        
        req.Require = Require_Closure
        req.FOnce = FOnce_Closure
        req.FAllow = FAllow_Closure
        req.AddToResponse = AddToResponse_Closure
        req.SetCacheTime = SetCacheTime_Closure
        
        # Generate a (relatively) unique user-tracking cookie from the original IP address    
        try:
            req.uidSigned = req.COOKIES['user-tracking']
            req.uid = SGetSigned(req, 'uid', req.uidSigned)
            req.mAllow.add('tracking')
        except:
            req.uid = "~".join((req.ipAddress, req.dtNow.strftime('%m/%d/%Y %H:%M'), str(random.randint(0, 10000))))
            req.uidSigned = SSign(req, 'uid', req.uid)
            logging.info("New tracking cookie: %s" % req.uid)
        req.mCookies['user-tracking'] = req.uidSigned
        
        if req.method == 'GET':
            req.mParams = req.GET
        else:
            req.mParams = req.POST
            req.mAllow.add('post')
        
        if 'csrf' in req.mParams:
            if req.mParams['csrf'] == req.uid:
                req.mAllow.update(['api', 'write'])
            else:
                logging.info("CSRF DOES NOT MATCH %s != %s" % (req.mParams.get('csrf',''), req.uid))
        
        if 'adult-content-ok' in req.COOKIES:
            req.mAllow.add('adult');
        
        # Requre that json calls have .json terminator
        req.fJSON = regJSON.match(req.path) is not None
        if req.fJSON:
            req.mAllow.add('json')
            
        req.fRSS = regRSS.match(req.path) is not None
        
        req.user = users.get_current_user()
        if (req.user):
            req.mAllow.add('user')
        req.fAdmin = users.is_current_user_admin()
        if req.fAdmin:
            req.mAllow.add('admin')

        # Client apikey: ip~rate
        # TODO: Not rate-limiting yet
        try:
            sAPI = SGetSigned(req, 'api-IP', req.mParams['apikey'])

            rgAPI = sAPI.split('~')
            ip = str(rgAPI[0])
            rate = int(rgAPI[1])
            if req.ipAddress == ip:
                req.mAllow.update(['api', 'write'])
        except: pass
        
        AddToResponse(req, {
            # Elapsed time evaluates when USED
            'elapsed': req.sResponseTime,
            'now': req.dtNow,
            'host': req.sHost,
            'request': req,
            'app_version': os.environ['CURRENT_VERSION_ID'],
    
            'csrf': req.uid,
            'user': req.user,
            'is_admin': req.FAllow('admin'),
            'is_user': req.FAllow('user'),
            'is_adult': req.FAllow('adult'),
            
            'logout': users.create_logout_url(req.get_full_path()),
            'login': users.create_login_url(req.get_full_path())
        })
        
        AddToResponse(req, settings.APP_CONFIG)
        
    def process_response(self, req, resp):
        req.mCookies['user-tracking'] = req.uidSigned

        for name in req.mCookies:
            if req.mCookies[name]:
                resp.set_cookie(name, req.mCookies[name], max_age=60*60*24*30)
            else:
                resp.delete_cookie(name)
                
        # Save POST-AJAX requests to memcache so they can be picked up by /get-results
        # method on a subsequent request.
        if req.fJSON and req.method == 'POST':
            if 'sid' in req.mParams and 'rid' in req.mParams:
                memcache.set("get-result~%s~%s" % (req.mParams['sid'], req.mParams['rid']), resp, 60)
                return HttpJSON(req, {'message':'/get-result.json?sid:%s&ridPost:%s available for 60 secs' %
                                      (req.mParams['sid'], req.mParams['rid'])})
        
        # Zero second cache will not be cached - standard headers will be
        # max-age=0
        if req.secsCache != 0:
            patch_response_headers(resp, req.secsCache)
        return resp
        
    def process_exception(self, req, e):
        if isinstance(e, DirectResponse):
            return e.resp
        sBacktrace = ''.join(traceback.format_list(traceback.extract_tb(sys.exc_info()[2])))
        
        if isinstance(e, Error):
            logging.info("Exception: %r" % e)
            logging.info(sBacktrace)
            return HttpError(req, e.obj['message'], obj=e.obj)
        
        # BUG: Should not over-ride default Django 404???
        if isinstance(e, Http404):
            return HttpError(req, "File not found", {'status': 'Fail/NotFound'})
        
        logging.error("Unknown exception: %r" % e)
        logging.error(sBacktrace)
        
        if not settings.DEBUG:
            return HttpError(req, "Application Error")
        
        # Even if debugging, force error message to be JSON-ified if needed
        if req.fJSON:
            return HttpError(req, "Application Error: %s" % e.message)
        
def FAllow(req, *sKeys):
    for sKey in sKeys:
        if sKey not in req.mAllow:
            return False
    return True

def Require(req, *sKeys):
    for sKey in sKeys:
        if sKey not in req.mAllow:
            if sKey == 'adult':
                raise DirectResponse(HttpResponseRedirect("/adult-warning?url=%s" % urllib.quote(req.get_full_path())))
                                     
            if sKey == 'admin' and req.user:
                raise DirectResponse(HttpResponseRedirect(users.create_logout_url(req.get_full_path())))
            if sKey in ['user', 'admin']:
                raise DirectResponse(HttpResponseRedirect(users.create_login_url(req.get_full_path())))
                      
            raise Error("Authorization Failure", 'Fail/Auth/%s' % sKey)
    
def FOnce(req, sKey):
    sMemKey = 'user.once.%s.%s' % (req.uid, sKey)
    if memcache.get(sMemKey):
        return False
    memcache.set(sMemKey, True)
    return True

def SGenUID():
    # Generate a unique user ID: IP~Date~Random
    return "~".join((local.ipAddress, local.dtNow.strftime('%m/%d/%Y %H:%M'), str(random.randint(0, 10000))))

def InitAPI(req):
    # Return an IP-specific API key to the client - 10 requests per minute max
    sKey = '~'.join((req.ipAddress, '10'))
    sSession = "~".join((req.ipAddress, req.dtNow.strftime('%m/%d/%Y %H:%M'), str(random.randint(0, 10000))))
    return HttpJSON(req, {'apikey':SSign(req, 'api-IP', sKey), 'sid':SSign(req, 'session', sSession)})

def Loopback(req):
    # Just for unit testing API calls and authentication
    # ?data={...json-object...}
    Require(req, 'api')
    sData = req.mParams.get('data', None)
    mData = simplejson.loads(sData)
    return HttpJSON(req, mData)
    
def GetResult(req):
    if (req.method != 'GET'):
        raise Error("/get-result must use GET method")

    resp = None
    try:
        resp = memcache.get("get-result~%s~%s" % (req.mParams['sid'], req.mParams['ridPost']))
    except: pass
    if resp == None:
        raise Error("Deferred result for sid:%s&rid:%s not available." %
                    (req.mParams['sid'], req.mParams['ridPost']))
    raise DirectResponse(resp)

def HttpError(req, sError, obj=None):
    if obj is None:
        obj = {}
    if not 'status' in obj:
        obj['status'] = 'Fail'
    obj['message'] = sError
    if req.fJSON:
        logging.info('JSON Error: %(message)s (%(status)s)' % obj)
        return HttpJSON(req, obj=obj)

    http_status = 200
    if obj['status'] == 'Fail/NotFound':
        http_status = 404
        
    t = loader.get_template('error.html')
    logging.info("Error: %r" % obj)
    AddToResponse(req, obj)
    AddToResponse(req, {'status_major': obj['status'].split('/')[0]})
    resp = HttpResponse(t.render(RequestContext(req)))
    resp.status_code = http_status
    return resp

def HttpJSON(req, obj=None):
    if obj is None:
        obj = {}
    if 'status' not in obj:
        obj['status'] = 'OK'
    resp = HttpResponse("%s(%s);" % (req.mParams.get("callback", "Callback"), simplejson.dumps(obj, cls=JavaScriptEncoder, indent=4)), mimetype="application/x-javascript")
    return resp

regRSSExt = re.compile(r".rss$")

def HttpRSS(req, feed=None, template=None):
    """
    Return an RSS feed.  feed should contain title, link, description, and items.
    items should in turn each have title, link, and description
    The default rss template can be over-ridden by including a template argument
    """
    if feed is None:
        feed = {}
    if template is None:
        template = 'rss.xml'

    feed.setdefault('title', "RSS Feed")
    feed.setdefault('link', "%s%s" % (req.sHost, req.get_full_path()))
    feed['link'] = regRSSExt.sub('', feed['link'])
    feed.setdefault('ttl_minutes', 60)

    logging.info("first item: %r" % feed['items'][0].rss())
    return RenderResponse(template, {'feed':feed}, 'application/rss+xml')

def HasRSS(req):
    AddToResponse(req, {'rss_url': "%s.rss" % req.path})

def AddToResponse(req, m):
    """ Add properties to a global context dictionary - available with RequestContext is called """
    req.mResponse.update(m)
    
def SetCacheTime(req, secs):
    """ Set the time for caching the result.  If 0, the page is not cached. """
    req.secsCache = secs
    
def GetContext(req):
    return req.mResponse

"""
JSON encoder helpers
"""

class JavaScriptEncoder(simplejson.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return ISODate(obj)
        return simplejson.JSONEncoder.default(self, obj)
    
class ISODate(simplejson.encoder.Atomic):
    def __init__(self, dt):
        self.dt = dt
        
    def __str__(self):
        return "%s.ISODate(\"%sZ\")" % (settings.sJSNamespace, self.dt.isoformat())
    
class JavaScript(simplejson.encoder.Atomic):
    def __init__(self, st):
        self.st = st;
        
    def __str__(self):
        return self.st;
    
def RenderResponse(sTemplate, mVars=None, mimetype=None):
    req = GetRequest()
    return render_to_response(sTemplate, dictionary=mVars, context_instance=RequestContext(req), mimetype=mimetype)
    
def GetRequest():
    return local.req

local = threading.local()