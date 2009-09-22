"""
jscomposer - Manage JavaScript includes and composing multiple files into one.

    by Mike Koss, June 2009 - released into the public domain.
    
    Features:
    
    - Generates <script> includes with version stamps to avoid cache conflicts.
    - You can define aliases for multiple javascript files to be included into one file
    - Minifies JavaScript files when not in DEBUG mode
    - Stores minified script files in memcache for faster serving
    
Usage:
    
    In settings.py add:
    
        SCRIPT_DIR = os.path.join(dirHome, 'scripts').replace('\\', '/')
        SCRIPT_DEBUG = DEBUG
        SCRIPT_COMBINE = not DEBUG
        SCRIPT_VERSION = os.environ['CURRENT_VERSION_ID']
        SCRIPT_CACHE = not DEBUG
        SCRIPT_ALIASES = {'alias':['file1', 'file2']}
        
    and add the jscomposer Context Processor:
    
        TEMPLATE_CONTEXT_PROCESSORS = (
            ...
            'jscomposer.GetContext',
        )
        
    The SCRIPT_VERSION should be changed for each release where any of your javascript files
    change.  This will prevent both browser AND memcached version of the old script files
    from being delivered.
    
    Warning: Be sure your scripts are NOT listed as a static directory in app.yaml as they
    will not be accessible to the appengine program (static files are served from a separate
    Google CDN).
    
    In urls.py add:
    
        (jscomposer.ScriptPattern('alias'), jscomposer.ScriptFile),
        (jscomposer.ScriptPattern(), jscomposer.ScriptFile),
        
    Optional format if you want to specify the list of component js files in urls.py -
    but you loose the ability to separately include script files for debugging (when
    SCRIPT_COMBINE is False):
    
        (jscomposer.ScriptPattern('alias'), jscomposer.ScriptFile,
            {'files': ['file1', 'file2', 'file3',]})
        
    Note: The second line matches any script file name - allows you to download individual javascript
    files.
    
    In your Django (master) template(s) add:
    
        {{ script_includes.alias }}
    
    to insert a <script> include in your web page.  Note that if SCRIPT_COMBINE is False,
    AND alias is included in SCRIPT_ALIASES, then a separate <script> tag will be included for
    each component file (to ease JavaScript debugging).
    
    Note: Accepted script paths are of the form:
    
        /scripts/name-<version>-<debug>.js (preferred)
        /scripts/name.js (may be cached to older version - be careful)
        
    where <version> is the script version number and debug is 0 or 1 for debugging (non-minified)
    versions.
    
    Note that the base name of a script file CANNOT have a '-' character embedded in it.

"""
from django.http import HttpResponse
from django.http import Http404
from django.utils import safestring

from google.appengine.api import memcache

import os.path
import logging

import settings
import jsmin

# Script url names use the base name, version number, and debug mode
SCRIPT_INC_PATTERN = r'<script src="/scripts/%s-%s-%d.js"></script>'
SCRIPT_URL_PATTERN = r'^scripts/(?P<name>%s)(-(?P<version>.+)-(?P<debug>[01]))?.js$'

def GetContext(req):
    """ Add script_includes variable to render context. """
    return {'script_includes': ScriptIncludes()}

class ScriptIncludes():
    """
    Return <script> tag(s) to include the file or alias.

    {{ script_includes.alias }}} -> <script src="/scripts/alias-V-D.js"></script>
    """
    def __getattr__(self, alias):
        if settings.SCRIPT_COMBINE or alias not in settings.SCRIPT_ALIASES:
            s = SCRIPT_INC_PATTERN % (alias, settings.SCRIPT_VERSION, settings.SCRIPT_DEBUG)
            return safestring.SafeString(s)
        
        s = '\n'.join([SCRIPT_INC_PATTERN % (name, settings.SCRIPT_VERSION, settings.SCRIPT_DEBUG)\
                          for name in settings.SCRIPT_ALIASES[alias]])
        return safestring.SafeString(s)
    
def ScriptPattern(name=None):
    """ For use in urls.py for script file url patterns. """

    if name is None:
        name = r'[a-zA-Z0-9_]+'
    return SCRIPT_URL_PATTERN % name
    
def ScriptFile(req, debug=None, version=None, name=None, files=None):
    """ Return the body of the selected script file (or alias)
    
    Called with either:
    
        1. a single 'name' (return file name.js)
        2. a 'name' and an array of 'files' (combine files into virtual name.js)
        
    """
    
    # If debug=0 not specified, we probably want non-minified version
    if debug is None:
        debug = True
    debug = bool(int(debug))
    
    if version is None:
        version = settings.SCRIPT_VERSION
    
    sMemKey = 'jscompose-%s-%s-%d' % (name, version, debug)
    
    if files is None:
        # Found an alias - include component files
        if name in settings.SCRIPT_ALIASES:
            files = settings.SCRIPT_ALIASES[name]
        # No alias - assume this is a singe javascript file
        else:
            files = [name]
    
    sScript = None
    if settings.SCRIPT_CACHE:
        req.SetCacheTime(30*24*3600)
        sScript = memcache.get(sMemKey)
    else:
        req.SetCacheTime(0)
    
    if sScript is None:
        # We only have the latest version of the script available if not already in memcache
        if version != settings.SCRIPT_VERSION:
            raise Http404
        sMemKey = 'jscompose-%s-%s-%d' % (name, settings.SCRIPT_VERSION, debug)
        sScript = ''    
        for name in files:
            if debug:
                sScript += "/* ---------- %s.js ---------- */\n" % name
            try:
                file = open(os.path.join(settings.SCRIPT_DIR, '%s.js' % name).replace('\\', '/'), 'r')
                sT = file.read() + '\n'

                if not debug:
                    sT  = jsmin.jsmin(sT)
                sScript += sT
                file.close()
            except:
                sScript += "/* Error loading file: %s.js */\n" % name

        if settings.SCRIPT_CACHE:
            logging.info("caching script %s" % sMemKey)
            # Limit memcache to 1 hour in case script version not incremented!
            memcache.set(sMemKey, sScript, 3600)
            # Keep the file in client caches for 30 days

    return HttpResponse(sScript, mimetype="application/x-javascript")
