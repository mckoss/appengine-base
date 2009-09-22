from google.appengine.ext import db
from google.appengine.api import memcache

import util

class Globals(db.Model):
    """
    Global application variables (stored in the database)
    Each model can store an incrementable integer or string.
    
    TODO: Use memcache and sharded counters for performance
    """
    idNext = db.IntegerProperty(default=0)
    s = db.StringProperty()
    
    @staticmethod
    def SGet(name, sDefault=""):
        # Global strings are constant valued - can only be updated in the store
        # via admin console 
        s = memcache.get('global.%s' % name)
        if s is not None:
            return s
        glob = Globals.get_or_insert(key_name=name, s=sDefault)
        # Since we can't bounce the server, force refresh each 60 seconds
        memcache.add('global.%s' % name, glob.s, time=60)
        return glob.s
        
    @staticmethod
    @util.RunInTransaction
    def IdNameNext(name, idMin=1):
        # Increment and return a global counter - starts at idMin
        glob = Globals._IdLookup(name, idMin)
        glob.idNext = glob.idNext + 1
        glob.put()
        return glob.idNext
    
    @staticmethod
    def IdGet(name, idMin=1):
        # Return value of a global counter - starts at idMin
        glob = Globals._IdLookup(name, idMin)
        return glob.idNext
    
    @staticmethod
    def _IdLookup(name, idMin):
        glob = Globals.get_by_key_name(name)
        if glob is None:
            glob = Globals(key_name=name)
        if glob.idNext < idMin-1:
            glob.idNext = idMin-1
        return glob      