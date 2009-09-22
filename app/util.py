from google.appengine.ext import db

import logging
import re
import string

def Href(url):
    # Quote url text so it can be embedded in an HTML href
    ich = url.find('//')
    path = url[ich+2:].replace('"', '%22')
    return url[0:ich+2] + path

def TrimString(st):
    if st == None:
        st = ''
    return re.sub('[\000-\037]', '', str(st)).strip()

def EscapeHTML(s):
    # Escape test so it does not have embedded HTML sequences
    return s.replace('&', '&amp;').\
        replace('<', '&lt;').\
        replace('>', '&gt;').\
        replace('"', '&quot;').\
        replace("'", '&#39;')

# Convert runs of all non-alphanumeric characters to single dashes 
regNonchar = re.compile(r"[^\w]")
regDashes = re.compile(r"[\-]+")
regPrePostDash = re.compile(r"(^-+)|(-+$)")

def Slugify(s):
    s = regNonchar.sub('-', s).lower()
    s = regDashes.sub('-', s)
    s = regPrePostDash.sub('', s)
    return s  

def RunInTransaction(func):
    # Function decorator to wrap entire function in an App Engine transaction
    def _transaction(*args, **kwargs):
        return db.run_in_transaction(func, *args, **kwargs)
    return _transaction

def GroupBy(aList, n):
    """ Group the elements of a list into a list with n elements in each sub-list
    Turns [1,2,3,4,5,6,7] into [[1,2,3],[4,5,6],[7]) """
    
    return [aList[i:i+n] for i in range(0, len(aList), n)]


class enum(object):
    __init = 1
    def __init__(self, *args, **kw):
        value = 0
        self.__names = args
        self.__dict = {}
        for name in args:
            if kw.has_key(name):
                value = kw[name]
            self.__dict[name] = value
            value = value + 1
        self.__init = 0

    def __getitem__(self, name):
        return getattr(self, name)

    def __getattr__(self, name):
        return self.__dict[name]

    def __setattr__(self, name, value):
        if self.__init:
            self.__dict__[name] = value
        else:
            raise AttributeError, "enum is ReadOnly"

    def __call__(self, name_or_value):
        if type(name_or_value) == type(0):
            for name in self.__names:
                if getattr(self, name) == name_or_value:
                    return name
            else:
                raise TypeError, "no enum for %d" % name_or_value
        else:
            return getattr(self, name_or_value)

    def __repr__(self):
        result = ['<enum']
        for name in self.__names:
            result.append("%s=%d" % (name, getattr(self, name)))
        return string.join(result)+'>'

    def __len__(self):
        return len(self.__dict)

    def __iter__(self):
        return self.__dict.__iter__()
    
    def items(self):
        return self.__dict.items()
    
    def keys(self):
        return self.__dict.keys()
    
    def values(self):
        return self.__dict.values()
