ENVIRONMENT = "unknown"
try:
    import os
    if os.environ["SERVER_SOFTWARE"].lower().startswith("dev"):
        ENVIRONMENT = "local"
    elif os.environ["SERVER_SOFTWARE"].lower().startswith("google apphosting"):
        ENVIRONMENT = "hosted"
except:
    pass

DEBUG = (ENVIRONMENT == "local")
TEMPLATE_DEBUG = DEBUG
CACHE_ON = not DEBUG

ADMINS = (
    ('Mike Koss', 'admin@quip-art.com'),
)

# Application Specific Settings

sSiteName = "My App Engine Application"
sSiteDomain = "my-appengine-app.com"
sSiteHost = 'www.' + sSiteDomain
sJSNamespace = "AE"
sTwitterSource = "my-appengine-app"
sTwitterUser = "my-appengine-app"
sSiteTitle = "A stub application template for App Engine"
sSiteTagline = "Brought to you by the Seattle GTUG"
sSecretName = "secret.1"

# Google Analytics Tracking Code
sAnalyticsCode = "UA-nnnnnnn-n"

# Google AdSense/AdManager Publisher ID
sAdPublisherID = "ca-pub-nnnnnnnnnnnnnnnn"

TIME_ZONE = 'PST8PDT US'
LANGUAGE_CODE = 'en-us'
USE_I18N = True

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.load_template_source',
    'django.template.loaders.app_directories.load_template_source',
)

MIDDLEWARE_CLASSES = (
    'django.middleware.common.CommonMiddleware',
    'baseapp.filter.ReqFilter',
)

ROOT_URLCONF = 'urls'

import os.path
dirHome = os.path.dirname(__file__)

TEMPLATE_DIRS = (
    os.path.join(dirHome, 'templates').replace('\\', '/')
)

# For jscomposer
SCRIPT_DIR = os.path.join(dirHome, 'scripts').replace('\\', '/')
SCRIPT_DEBUG = DEBUG
#SCRIPT_DEBUG = False
SCRIPT_COMBINE = not SCRIPT_DEBUG
SCRIPT_VERSION = os.environ['CURRENT_VERSION_ID']
SCRIPT_CACHE = not SCRIPT_DEBUG
SCRIPT_ALIASES = {'aebase':['namespace', 'base', 'main']}

TEMPLATE_CONTEXT_PROCESSORS = (
    'django.core.context_processors.debug',
    'baseapp.filter.GetContext',
    'jscomposer.GetContext',
    )

INSTALLED_APPS = (
    'django.contrib.humanize',
    'baseapp',
    'jscomposer',
)
