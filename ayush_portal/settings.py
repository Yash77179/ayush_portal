"""
Django settings for CareerBridge — Academia–Industry Collaboration Portal
SIH26044 | Ministry of Ayush
"""

import os
from pathlib import Path
from decouple import config, Csv
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("SECRET_KEY", default="django-insecure-careerbridge-dev-key-change-in-production-xyz")
DEBUG = config("DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="*", cast=Csv())

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    # Local apps
    "accounts",
    "institutions",
    "internships",
    "applications",
    "analytics",
    "assistant",
    "notifications",
    "campus",
    "filestore",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "ayush_portal.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "ayush_portal.wsgi.application"

# Database — PostgreSQL if DATABASE_URL is set (production), SQLite otherwise (local development)
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    try:
        import dj_database_url
        # conn_health_checks: Neon's free tier suspends idle databases, so check a kept-open connection before reusing it.
        DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600, conn_health_checks=True)}
        # Neon's pooled endpoint ("-pooler" host) runs PgBouncer in transaction mode, which can't hold server-side cursors.
        if "-pooler" in (DATABASES["default"].get("HOST") or ""):
            DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True
    except ImportError:
        import urllib.parse as urlparse
        url = urlparse.urlparse(DATABASE_URL)
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": url.path.lstrip("/"),
                "USER": url.username,
                "PASSWORD": url.password,
                "HOST": url.hostname,
                "PORT": url.port or 5432,
            }
        }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Custom user model
AUTH_USER_MODEL = "accounts.User"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# Static & media files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

MEDIA_URL = "/media/"
# Uploads (resumes, photos, logos) when stored on disk — used locally. Production keeps them in the database (FILE_STORAGE below).
MEDIA_ROOT = config("MEDIA_ROOT", default=str(BASE_DIR / "media"))

# Production (DEBUG off): the host (Render) terminates HTTPS at its proxy and forwards plain HTTP, so trust its
# header, and only send cookies over HTTPS. The host already redirects HTTP to HTTPS.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# JWT Settings
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# CORS & CSRF — allow Next.js frontend (local and deployed)
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=Csv(),
)

# Enable WhiteNoise automatically if installed (production)
try:
    import whitenoise  # noqa: F401
    MIDDLEWARE.insert(2, "whitenoise.middleware.WhiteNoiseMiddleware")
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
except ImportError:
    pass

# Where uploads go. Locally: the media/ folder. In production on a host without a persistent disk
# (Render's free plan), keep resumes, photos and logos somewhere permanent:
#   FILE_STORAGE=cloudinary  → Cloudinary (needs CLOUDINARY_URL)   ·   FILE_STORAGE=database → Postgres
_FILE_BACKENDS = {"cloudinary": "filestore.storage.CloudinaryStorage", "database": "filestore.storage.DatabaseStorage"}
FILE_STORAGE = config("FILE_STORAGE", default="filesystem")
if FILE_STORAGE in _FILE_BACKENDS:
    STORAGES = {
        **globals().get("STORAGES", {"staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}}),
        "default": {"BACKEND": _FILE_BACKENDS[FILE_STORAGE]},
    }

# Google sign-in: the OAuth "Web application" client ID (no secret needed — the browser popup does the OAuth part)
GOOGLE_CLIENT_ID = config("GOOGLE_CLIENT_ID", default="")

# Bridge, the AI assistant. NVIDIA answers first, then OpenRouter, then Google Gemini — each one a backup for the last.
# Without any key the chat explains that it is not set up yet.
NVIDIA_API_KEY = config("NVIDIA_API_KEY", default="")
NVIDIA_MODEL = config("NVIDIA_MODEL", default="nvidia/nemotron-3.5-super-vl-120b-a12b")
NVIDIA_THINKING = config("NVIDIA_THINKING", default=True, cast=bool)  # let the model reason before answering (not shown)
# second in line: OpenRouter (openrouter.ai). Models ending in ":free" cost nothing.
OPENROUTER_API_KEY = config("OPENROUTER_API_KEY", default="")
OPENROUTER_MODEL = config("OPENROUTER_MODEL", default="google/gemma-4-31b-it:free")
GEMINI_API_KEY = config("GEMINI_API_KEY", default="")
# tried in order: if one is overloaded (503) before answering, the next one takes over
GEMINI_MODELS = config("GEMINI_MODELS", default="gemini-3.5-flash,gemini-3.8-flash,gemini-flash-latest", cast=Csv())
# Bridge's spoken voice: Speechify (simba-3.5) first, Microsoft Edge neural voices (free, no key) as the backup
SPEECHIFY_API_KEY = config("SPEECHIFY_API_KEY", default="")
SPEECHIFY_MODEL = config("SPEECHIFY_MODEL", default="simba-3.5")
