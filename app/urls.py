from django.conf.urls.defaults import patterns
from django.views.generic.simple import redirect_to
from django.views.generic.simple import direct_to_template
import quipart.views, quipart.models
import reqfilter
import jscomposer

urlpatterns = []

urlpatterns.extend(reqfilter.filter.JSONUrls())

urlpatterns.extend(patterns('',
    (r'^$', quipart.views.Home),
    (r'^AboutUs$', direct_to_template, {'template':'about-us.html'}),
    (r'^TermsOfService$', direct_to_template, {'template':'t-o-s.html'}),
    
    (r'^test$', direct_to_template, {'template':'test.html'}),

    (r'^(?P<url>https?://.*)$', quipart.views.PageBuilder),
    (r'^builder$', quipart.views.PageBuilder),

    (r'^make-page$', quipart.views.MakePage),
    (r'^edit-page\.json$', quipart.views.UpdatePage),

    (r'^overlay$', redirect_to, {'url':r'/overlay/'}),
    (r'^overlay/(?P<id>[0-9]*)(\.rss)?$', quipart.views.OverlayForm),
    (r'^overlay/(?P<id>[0-9]+).png$', quipart.views.OverlayImage, {'size':'full'}),
    (r'^overlay/(?P<id>[0-9]+)_med.png$', quipart.views.OverlayImage, {'size':'med'}),
    (r'^moderate-overlay\.json$', quipart.views.ModerateOverlay),
    
    (r'^popular(\.json|\.rss)?$', quipart.views.PopularOverlays),
    (r'^new(\.json)?$', quipart.views.NewOverlays),
    
    (r'^adult-warning$', direct_to_template, {'template': 'adult-warning.html'}),

    (r'^admin/(?P<command>[a-z\-]+)?$', quipart.views.Admin),
    (r'^admin/update-pages\.json', quipart.models.Page.UpdateAllSchema),
    
    (r'^([0-9A-Za-z]+)$', quipart.views.OverlayPage),
    (r'^view-page\.json$', quipart.views.ViewPage),
    
    (jscomposer.ScriptPattern('quip_art'), jscomposer.ScriptFile),
    (jscomposer.ScriptPattern(), jscomposer.ScriptFile),

    (r'^.*$', quipart.views.CatchAll),
))
