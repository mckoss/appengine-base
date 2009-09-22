from google.appengine.ext import db
from google.appengine.api import users, memcache

from django.http import HttpResponseRedirect, HttpResponse
from django.template import RequestContext

import util
import models
from baseapp import filter

import logging

def Home(req):
    return filter.RenderResponse('home.html')

# TODO: Kludge - can this be in filter instead - never use 404 template file?
# Note that this handles JSON calls too!
def CatchAll(req):
    raise filter.Error("Page not found.", "Fail/NotFound")

def Admin(req, command=None):
    req.Require('admin')
    
    # BUG - Add CSRF required field
    if command:
        logging.info("admin command: %s" % command)
        req.Require('api')

        if req.fJSON:
            return filter.HttpJSON(req, {})
        return HttpResponseRedirect("/admin/")

    try:
        ms = memcache.get_stats()
        mpMem = [{'key':key, 'value':ms[key]} for key in ms]
    except:
        mpMem = [{'key':'message', 'value':'memcache get_stats() failure!'}]

    req.AddToResponse(
          {
           'logout':users.create_logout_url(req.get_full_path()),
           'cUnscopedComments':len(Comment.Unscoped()),
           'MemCache': mpMem
           })
    return filter.RenderResponse('admin.html')
          
