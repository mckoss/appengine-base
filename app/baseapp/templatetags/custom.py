from django import template
from django.template.defaultfilters import stringfilter
from django.utils import safestring, encoding, html

import baseapp.filter
import util
import settings
import simplejson
from datetime import datetime, timedelta
import logging

import re

register = template.Library()

@register.filter(name='ellipsis')
@stringfilter
def ellipsis(value, arg):
    """
    Truncates a string more than arg characters and appends elipsis
    """
    try:
        length = int(arg)
    except ValueError: # invalid literal for int()
        return value # Fail silently.
    if (len(value) > length):
        return value[:length] + "..."
    else:
        return value
    
@register.filter(name='mult')
def MultFilter(value, arg):
    try:
        return float(value) * float(arg)
    except:
        return 0.0

# ------------------------------------------------------------------
# urlized copied (modified) from Django html.py
# ------------------------------------------------------------------

# Configuration for urlize() function
LEADING_PUNCTUATION  = ['(', '<', '&lt;']
TRAILING_PUNCTUATION = ['.', ',', ')', '>', '\n', '&gt;']

word_split_re = re.compile(r'(\s+)')
punctuation_re = re.compile('^(?P<lead>(?:%s)*)(?P<middle>.*?)(?P<trail>(?:%s)*)$' % \
    ('|'.join([re.escape(x) for x in LEADING_PUNCTUATION]),
    '|'.join([re.escape(x) for x in TRAILING_PUNCTUATION])))
simple_email_re = re.compile(r'^\S+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+$')
twitter_re = re.compile(r'@[a-zA-Z0-9_]+')
domain_re = re.compile(r"^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|" + \
    r"(([a-z0-9][a-z0-9-]*\.)+([a-z]{2}|" + \
    r"aero|asia|biz|cat|com|coop|edu|gov|info|int|jobs|mil|mobi|museum|net|org|pro|tel|travel))$", re.I)

def urlize(text, trim_url_limit=None, nofollow=False, target=None, extra=None, FUseExtra=None):
    """
    Converts any URLs in text into clickable links. Works on http://, https:// and
    www. links. Links can have trailing punctuation (periods, commas, close-parens)
    and leading punctuation (opening parens) and it'll still do the right thing.

    If trim_url_limit is not None, the URLs in link text will be limited to
    trim_url_limit characters.

    If nofollow is True, the URLs in link text will get a rel="nofollow" attribute.
    
    If target is given, set as target attribute of link (e.g., _blank, _top, or <frame_name>)
    """
    trim_url = lambda x, limit=trim_url_limit: limit is not None and (x[:limit] + (len(x) >=limit and '...' or ''))  or x
    words = word_split_re.split(text)
    nofollow_attr = nofollow and ' rel="nofollow"' or ''
    
    sTarget = ''
    if target is not None:
        sTarget = ' target="%s"' % target
        
    sPattern = '<a href="%(href)s"%(nofollow)s%(target)s>%(trim)s</a>'
    if extra:
        sPatternExtra = sPattern + extra
        
    for i, word in enumerate(words):
        match = punctuation_re.match(word)
        if match:
            lead, middle, trail = match.groups()
            if simple_email_re.match(middle):
                middle = '<a href="mailto:%s">%s</a>' % (middle, middle)
            elif twitter_re.match(middle):
                middle = '<a%s href="http://twitter.com/%s">%s</a>' % (sTarget, middle[1:], middle)
            else:
                sTrim = trim_url(middle)
                if domain_re.match(middle):
                    middle = 'http://' + middle
                if middle.startswith('http://') or middle.startswith('https://'):
                    sPatT = sPattern
                    if extra and (not FUseExtra or FUseExtra(middle)):
                        sPatT = extra and (sPattern + extra)
                    middle = sPatT % {'target':sTarget, 'href':util.Href(middle),
                                      'nofollow':nofollow_attr, 'trim':sTrim}

            if lead + middle + trail != word:
                words[i] = lead + middle + trail
    return safestring.SafeString(''.join(words))
    
@register.filter(name='urlize_quip')
@stringfilter
def urlize_quip(value, sAttr=None):
    # Converts URLs in plain text into clickable links
    return urlize(value, nofollow=True, target="_blank")

# --------------------------------------------------------------------
# setvar tag from Django issue: http://code.djangoproject.com/ticket/1322
# --------------------------------------------------------------------

class SetVariable(template.Node):
    def __init__(self, varname, nodelist):
        self.varname = varname
        self.nodelist = nodelist

    def render(self,context):
        context[self.varname] = self.nodelist.render(context) 
        return ''

@register.tag(name='setvar')
def setvar(parser, token):
    """
    Set value to content of a rendered block. 
    {% setvar var_name %}
     ....
    {% endsetvar
    """
    try:
        # split_contents() knows not to split quoted strings.
        tag_name, varname = token.split_contents()
    except ValueError:
        raise template.TemplateSyntaxError, "%r tag requires a single argument for variable name" % token.contents.split()[0]

    nodelist = parser.parse(('endsetvar',))
    parser.delete_first_token()
    return SetVariable(varname, nodelist)

"""
double_escape block - for use in RSS description!
"""
class DoubleEscape(template.Node):
    def __init__(self, nodelist):
        self.nodelist = nodelist

    def render(self,context):
        s = self.nodelist.render(context) 
        return safestring.mark_safe(_escape(s))

@register.tag(name='double_escape')
def double_escape(parser, token):
    """
    Force an extra level of HTML escaping on the enclosed text
    """
    try:
        # split_contents() knows not to split quoted strings.
        tag_name = token.split_contents()
    except ValueError:
        raise template.TemplateSyntaxError, "%r tag requires no arguments" % token.contents.split()[0]

    nodelist = parser.parse(('enddouble_escape',))
    parser.delete_first_token()
    return DoubleEscape(nodelist)

def _escape(html):
    """
    Returns the given HTML with ampersands, quotes and angle brackets encoded.
    """
    return encoding.force_unicode(html).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#39;')

# --------------------------------------------------------------------
# String utilities - format date as an "age"
# --------------------------------------------------------------------

@register.filter(name='Age')
def SAgeReq(dt):
    # Return the age (time between time of request and a date) as a string
    return SAgeDdt(util.local.dtNow - dt)

def SAgeDdt(ddt):
    """ Format a date as an "age" """
    if ddt.days < 0:
        return "in the future?"
    months = int(ddt.days*12/365)
    years = int(ddt.days/365)
    if years >= 1:
        return "%d year%s ago" % (years, SPlural(years))
    if months >= 3:
        return "%d months ago" % months 
    if ddt.days == 1:
        return "yesterday"
    if ddt.days > 1:
        return "%d days ago" % ddt.days
    hrs = int(ddt.seconds/60/60)
    if hrs >= 1:
        return "%d hour%s ago" % (hrs, SPlural(hrs))
    minutes = round(ddt.seconds/60)
    if minutes < 1:
        return "seconds ago"
    return "%d minute%s ago" % (minutes, SPlural(minutes))

def SPlural(n, sPlural="s", sSingle=''):
    return [sSingle, sPlural][n!=1]

dtJSBase = datetime(1970, 1, 1)

@register.filter(name='MSJavascript')
def SAgeReq(dt):
    # Convert date to number of ms since 1/1/1970
    tdelta = dt - dtJSBase
    ms = int(tdelta.days*24*60*60*1000 + tdelta.seconds*1000 + tdelta.microseconds/1000)
    return ms

# --------------------------------------------------------------------
# Convert object to JSON format for inclusion in web page
# --------------------------------------------------------------------
@register.filter(name='JSON')
def SJSON(obj):
    s = simplejson.dumps(obj, cls=filter.JavaScriptEncoder, indent=4)
    return safestring.SafeString(s)

@register.filter(name='href')
@stringfilter
def Href(url):
    # Quote url text so it can be embedded in an HTML href
    ich = url.find('//')
    path = url[ich+2:].replace('"', '%22')
    return url[0:ich+2] + path

@register.filter(name='Lookup')
def Lookup(m, key):
    return m[key]

# Simple HTML form helpers

@register.filter(name='checked')
def Checked(f):
    if f:
        return ' checked '
    return ' '

@register.filter(name="options")
def Options(current, mValues):
    """ Return the collection of key/value options for an HTML <select> statement
    
    mValues is a dictionary (like) object with key's equal to the user-visible names of each option
    and values equal to the value to submit as the POSTed value of that option.
    
    The sort order of the options is by the order of the POSTed values.
    """
    s = ""
    pairs = mValues.items()
    pairs.sort(lambda x,y: cmp(x[1], y[1]))
    try:
        for pair in pairs:
            s += '\n<option %svalue="%s">%s</option>' % \
                (pair[1] == current and 'selected="selected" ' or '', pair[1], pair[0])
    except Exception, e:
        logging.info("Options error %r" % e)
        return "<!-- Select Error-->"
    return safestring.SafeString(s)
