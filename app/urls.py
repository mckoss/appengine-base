from django.conf.urls.defaults import patterns
from django.views.generic.simple import redirect_to
from django.views.generic.simple import direct_to_template
import baseapp
import jscomposer

urlpatterns = []

urlpatterns.extend(baseapp.filter.JSONUrls())

urlpatterns.extend(patterns('',
    (r'^$', baseapp.views.Home),
    (r'^AboutUs$', direct_to_template, {'template':'about-us.html'}),
    (r'^TermsOfService$', direct_to_template, {'template':'t-o-s.html'}),
    
    (r'^adult-warning$', direct_to_template, {'template': 'adult-warning.html'}),

    (r'^admin/(?P<command>[a-z\-]+)?$', baseapp.views.Admin),
    
    (jscomposer.ScriptPattern('quip_art'), jscomposer.ScriptFile),
    (jscomposer.ScriptPattern(), jscomposer.ScriptFile),

    (r'^.*$', baseapp.views.CatchAll),
))
