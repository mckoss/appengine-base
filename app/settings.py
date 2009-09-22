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

# Application Specific Settings
APP_CONFIG = {
    'site_name': "My App Engine Application",
    'site_host': 'www.my-appengine-app.com',
    'site_domain': "my-appengine-app.com",
    'site_title': "A stub application template for App Engine",
    'site_tagline': "Brought to you by the Seattle GTUG",
    
    'js_namespace': "AE",
    
    'twitter_source': "", # Twitter registered application id
    'twitter_user': "", # Twitter user id for the application

    'is_debug': DEBUG,

    'analytics_code': "", # e.g., "UA-nnnnnnn-n"
    'ad_publisher_id': "", # e.g., "ca-pub-nnnnnnnnnnnnnnnn"
    'webmaster_verification_files': [], # e.g., ["google9eab28331a1ab405.html"]
    
    'admin_name': "",
    'admin_email': "", # e.g., admin@domain.com
    
    'get_satisfaction': True, # Use the getsatisfaction.com feedback widget
}

sSecretName = "secret.1"

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
SCRIPT_ALIASES = {'appengine_base':['namespace', 'base', 'main']}

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
